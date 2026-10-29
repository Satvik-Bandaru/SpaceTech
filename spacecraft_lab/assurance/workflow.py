"""Local durable job boundaries and explicit plan approval. No arbitrary task execution."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import uuid

from .contracts import digest,validate_options
from .agents import MissionCancelled
from .runner import run_assurance,implementation_manifest
from ..engineering.config import engineering_config

ID=re.compile(r'^[a-f0-9]{32}$')
TERMINAL={'COMPLETE','CANCELLED','FAILED'}


def utc():
    return datetime.now(timezone.utc).isoformat()


class WorkflowStore:
    def __init__(self,path):
        self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True)
        self.owner_id=uuid.uuid4().hex;self.owned_jobs=set()
        self.executor=ThreadPoolExecutor(max_workers=1,thread_name_prefix='spacecraft-assurance')
        with self._db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, plan TEXT NOT NULL, plan_sha TEXT NOT NULL, status TEXT NOT NULL, result TEXT, result_sha TEXT, checkpoint TEXT, error TEXT, audit TEXT NOT NULL)')
            if 'owner_id' not in [row[1] for row in db.execute('PRAGMA table_info(jobs)')]:db.execute('ALTER TABLE jobs ADD COLUMN owner_id TEXT')
            if 'progress' not in [row[1] for row in db.execute('PRAGMA table_info(jobs)')]:db.execute('ALTER TABLE jobs ADD COLUMN progress TEXT')
            db.execute('CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, pid INTEGER NOT NULL, active INTEGER NOT NULL)')
            db.execute('INSERT INTO owners VALUES(?,?,1)',(self.owner_id,os.getpid()))
            interrupted=db.execute("SELECT jobs.id, owners.pid, owners.active FROM jobs LEFT JOIN owners ON jobs.owner_id=owners.id WHERE status IN ('RUNNING','QUEUED','CANCEL_REQUESTED')").fetchall()
        self.path.chmod(0o600)
        for row in interrupted:
            alive=False
            if row['active'] and row['pid']:
                try:os.kill(row['pid'],0);alive=True
                except ProcessLookupError:pass
                except PermissionError:alive=True
            if not alive:self._change(row['id'],'FAILED',expected={'RUNNING','QUEUED','CANCEL_REQUESTED'},error='Process restart interrupted this job; prepare a new run explicitly. No physics restore is claimed.')

    @contextmanager
    def _db(self):
        db=sqlite3.connect(self.path,timeout=5)
        db.row_factory=sqlite3.Row
        try:
            with db:yield db
        finally:db.close()

    def _row(self,job_id):
        if not isinstance(job_id,str) or not ID.fullmatch(job_id):raise ValueError('Invalid job ID')
        with self._db() as db:row=db.execute('SELECT * FROM jobs WHERE id=?',(job_id,)).fetchone()
        if row is None:raise ValueError('Unknown job ID')
        if digest(json.loads(row['plan']))!=row['plan_sha']:raise ValueError('Stored plan content-integrity check failed')
        return row

    def _change(self,job_id,status,expected=None,**values):
        with self._db() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT status,audit FROM jobs WHERE id=?',(job_id,)).fetchone()
            if expected is not None and row['status'] not in expected:return False
            if 'result' in values:
                size=len(values['result'].encode('utf-8'))
                allocated=db.execute('PRAGMA page_count').fetchone()[0]*db.execute('PRAGMA page_size').fetchone()[0]
                if size>32000000 or allocated+size>256000000:raise ValueError('Workflow result/store resource limit exceeded')
            audit=json.loads(row['audit']);audit.append(dict(previous=row['status'],status=status,at_utc=utc()))
            columns={'status':status,'audit':json.dumps(audit),**values}
            db.execute('UPDATE jobs SET '+','.join(key+'=?' for key in columns)+' WHERE id=?',(*columns.values(),job_id))
        return True

    def prepare(self,scenario,options):
        cfg=engineering_config(scenario)
        config=asdict(cfg);config['faults']=list(config['faults'])
        plan=dict(schema_version='assurance-plan-1.0',scenario=config,options=validate_options(options),
            implementation_sha256=implementation_manifest(),
            objective='Evaluate rule-based recovery through an independent safety kernel, against protected no-actuator recovery',
            limits=dict(max_wall_seconds=30,engine_intervals=2*cfg.duration_seconds//cfg.dt_seconds),
            approval_scope='Simulated actions only; no source changes, external tools or hardware access')
        return self._prepare_plan(plan)

    def prepare_campaign(self,request):
        from ..campaigns import normalize_campaign
        normalized=normalize_campaign(request)
        configs=[normalized['scenario'],*[{**normalized['scenario'],**v['changes']} for v in normalized['variants']]]
        weighted=sum(c['duration_seconds']//c['dt_seconds'] for c in configs)*len(normalized['seeds'])*sum(2 if s=='assured' else 1 for s in normalized['strategies'])
        plan=dict(schema_version='campaign-plan-1.0',kind='campaign',request=normalized,
            implementation_sha256=implementation_manifest(),
            objective='Paired initial-condition counterfactual reruns and recorded strategy comparisons',
            limits=dict(max_wall_seconds=30,engine_intervals=weighted,
                primary_runs=len(configs)*len(normalized['seeds'])*len(normalized['strategies'])),
            approval_scope='Bounded local synthetic simulations only; no hardware or external tools')
        return self._prepare_plan(plan)

    def _prepare_plan(self,plan):
        job_id=uuid.uuid4().hex
        with self._db() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0]>=64:raise ValueError('Local workflow store capacity reached (64 jobs); archive it explicitly before creating more')
            db.execute('INSERT INTO jobs(id,plan,plan_sha,status,audit) VALUES(?,?,?,?,?)',
                (job_id,json.dumps(plan),digest(plan),'PREPARED',json.dumps([dict(previous=None,status='PREPARED',at_utc=utc())])))
        return self.get(job_id)

    def list_jobs(self,limit=20):
        if type(limit) is not int or not 1<=limit<=64:raise ValueError('History limit must be an integer from 1 to 64')
        with self._db() as db:
            total=db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0]
            rows=db.execute('SELECT id,plan,plan_sha,status,audit,progress,error FROM jobs ORDER BY rowid DESC LIMIT ?',(limit,)).fetchall()
        jobs=[]
        for row in rows:
            plan=json.loads(row['plan'])
            if digest(plan)!=row['plan_sha']:raise ValueError('Stored plan content-integrity check failed')
            audit=json.loads(row['audit'])
            jobs.append(dict(job_id=row['id'],kind=plan.get('kind','assurance'),
                name=plan.get('request',{}).get('name','Mission assurance'),status=row['status'],
                created_at=audit[0]['at_utc'],updated_at=audit[-1]['at_utc'],
                progress=json.loads(row['progress']) if row['progress'] else None,error=row['error']))
        return dict(jobs=jobs,total=total)

    def approve(self,job_id,plan_sha256,background=True):
        row=self._row(job_id)
        if plan_sha256!=row['plan_sha']:raise ValueError('Approval must match the exact prepared plan digest')
        if json.loads(row['plan'])['implementation_sha256']!=implementation_manifest():raise ValueError('Model implementation changed; prepare a new plan before approval')
        with self._db() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT status FROM jobs WHERE id=?',(job_id,)).fetchone()[0]!='PREPARED':raise ValueError('Only a prepared job can be approved')
            if db.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('QUEUED','RUNNING','CANCEL_REQUESTED')").fetchone()[0]>=4:raise ValueError('At most four queued/running jobs')
            audit=json.loads(row['audit']);audit.append(dict(previous='PREPARED',status='QUEUED',at_utc=utc(),approved_plan_sha256=plan_sha256))
            db.execute('UPDATE jobs SET status=?,audit=?,owner_id=? WHERE id=?',('QUEUED',json.dumps(audit),self.owner_id,job_id))
        self.owned_jobs.add(job_id)
        if background:self.executor.submit(self._run,job_id)
        else:self._run(job_id)
        return self.get(job_id)

    def _run(self,job_id):
        row=self._row(job_id)
        if row['status']=='CANCELLED':return
        plan=json.loads(row['plan']);started=time.monotonic()
        if not self._change(job_id,'RUNNING',expected={'QUEUED'}):return
        last_poll=0;stop_reason=None
        def cancelled():
            nonlocal last_poll,stop_reason
            now=time.monotonic()
            if now-started>30:stop_reason='DEADLINE';return True
            if now-last_poll>=.02:
                last_poll=now
                if self._row(job_id)['status']=='CANCEL_REQUESTED':stop_reason='CANCELLED';return True
            return False
        try:
            if plan['implementation_sha256']!=implementation_manifest():raise ValueError('Model implementation changed after approval')
            if plan.get('kind')=='campaign':
                from ..campaigns import run_campaign
                def progress(value):
                    with self._db() as db:db.execute("UPDATE jobs SET progress=? WHERE id=? AND status='RUNNING'",(json.dumps(value,allow_nan=False),job_id))
                result=run_campaign(plan['request'],cancelled=cancelled,progress=progress)
                last_time=max(v['config']['duration_seconds'] for v in result['variants'])
            else:
                result=run_assurance(plan['scenario'],plan['options'],cancelled)
                last_time=result['telemetry'][-1]['time_seconds']
            if self._row(job_id)['status']=='CANCEL_REQUESTED':
                self._change(job_id,'CANCELLED',checkpoint=json.dumps(dict(last_time_seconds=last_time,replay_from_seed_required=True)))
                return
            if result['checks']['violations'] or result.get('baseline',{}).get('checks',{}).get('violations'):raise ValueError('Numerical invariant violation')
            fingerprint=digest(result)
            if time.monotonic()-started>30:raise ValueError('30-second workflow deadline exceeded before completion')
            checkpoint=dict(schema_version='workflow-checkpoint-1.0',last_time_seconds=last_time,
                result_sha256=fingerprint,completed=True,limitation='Durable complete-run restore; mid-integrator restore is not implemented')
            completed=self._change(job_id,'COMPLETE',expected={'RUNNING'},result=json.dumps(result,allow_nan=False),result_sha=fingerprint,checkpoint=json.dumps(checkpoint))
            if not completed:self._change(job_id,'CANCELLED',expected={'CANCEL_REQUESTED'},checkpoint=json.dumps(checkpoint))
        except MissionCancelled as exc:
            self._change(job_id,'FAILED' if stop_reason=='DEADLINE' else 'CANCELLED',expected={'RUNNING','CANCEL_REQUESTED'},checkpoint=json.dumps(exc.checkpoint),error='30-second deadline exceeded' if stop_reason=='DEADLINE' else None)
        except Exception as exc:
            # Worker failures become durable status, never executable recovery instructions.
            self._change(job_id,'FAILED',expected={'RUNNING','QUEUED','CANCEL_REQUESTED'},error=f'{type(exc).__name__}: {str(exc)[:500]}')

    def cancel(self,job_id):
        for _ in range(4):
            row=self._row(job_id)
            if row['status'] in TERMINAL:return self.get(job_id)
            target='CANCEL_REQUESTED' if row['status'] in ('RUNNING','CANCEL_REQUESTED') else 'CANCELLED'
            if self._change(job_id,target,expected={row['status']}):return self.get(job_id)
        raise ValueError('Job state changed; inspect and retry cancellation')

    def get(self,job_id,include_result=False):
        row=self._row(job_id)
        result=dict(job_id=job_id,plan=json.loads(row['plan']),plan_sha256=row['plan_sha'],status=row['status'],
            checkpoint=json.loads(row['checkpoint']) if row['checkpoint'] else None,error=row['error'],audit=json.loads(row['audit']),
            progress=json.loads(row['progress']) if row['progress'] else None)
        result['kind']=result['plan'].get('kind','assurance')
        if include_result:
            report=json.loads(row['result']) if row['result'] else None
            if report is not None and digest(report)!=row['result_sha']:raise ValueError('Stored result content-integrity check failed')
            result['result']=report
        return result

    def close(self):
        for job_id in self.owned_jobs:self.cancel(job_id)
        self.executor.shutdown(wait=True,cancel_futures=True)
        with self._db() as db:db.execute('UPDATE owners SET active=0 WHERE id=?',(self.owner_id,))
