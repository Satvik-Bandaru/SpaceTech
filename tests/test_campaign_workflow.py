import json
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
import sqlite3
from unittest.mock import patch

from spacecraft_lab.assurance.workflow import WorkflowStore


REQUEST=dict(name='Paired test',scenario={'duration_seconds':120},
    variants=[{'name':'Lower load','changes':{'normal_load_w':80}}],seeds=[2,3],strategies=['basic','assured'])


class CampaignWorkflowTests(unittest.TestCase):
    def test_running_campaign_cancellation_keeps_progress_without_complete_result(self):
        from spacecraft_lab.campaigns import run_campaign
        with tempfile.TemporaryDirectory() as folder:
            store=WorkflowStore(Path(folder)/'jobs.sqlite')
            job=store.prepare_campaign({**REQUEST,'scenario':{'duration_seconds':3600}})
            completed=[];requested=False
            def execution(request,cancelled=None,progress=None):
                def observe(value):
                    nonlocal requested
                    progress(value);completed.append(value['completed_runs'])
                    if value['completed_runs']>=1 and not requested:
                        requested=True;store.cancel(job['job_id'])
                return run_campaign(request,cancelled=cancelled,progress=observe)
            clock=iter(n*.005 for n in range(100000))
            with patch('spacecraft_lab.campaigns.run_campaign',side_effect=execution),patch('spacecraft_lab.assurance.workflow.time.monotonic',side_effect=lambda:next(clock)):
                store.approve(job['job_id'],job['plan_sha256'],background=False)
            result=store.get(job['job_id'],True)
            self.assertTrue(requested)
            self.assertEqual(result['status'],'CANCELLED',result.get('error'))
            self.assertIsNone(result['result'])
            self.assertLess(max(completed),8)
            self.assertIsNotNone(result['checkpoint'])
            store.close()

    def test_old_store_schema_migrates_without_losing_prepared_job(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'old.sqlite'
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE jobs (id TEXT PRIMARY KEY, plan TEXT NOT NULL, plan_sha TEXT NOT NULL, status TEXT NOT NULL, result TEXT, result_sha TEXT, checkpoint TEXT, error TEXT, audit TEXT NOT NULL)')
                from spacecraft_lab.assurance.contracts import digest
                plan={'schema_version':'historical-test','scenario':{}}
                db.execute('INSERT INTO jobs(id,plan,plan_sha,status,audit) VALUES(?,?,?,?,?)',('a'*32,json.dumps(plan),digest(plan),'PREPARED',json.dumps([{'at_utc':'2026-10-28T00:00:00+00:00'}])))
            store=WorkflowStore(path)
            self.assertEqual(store.get('a'*32)['status'],'PREPARED')
            self.assertIsNone(store.get('a'*32)['progress'])
            self.assertEqual(store.list_jobs()['total'],1)
            store.close()

    def test_cli_campaign_prepare_history_approval_and_text_exports(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(__file__).resolve().parents[1]
            request=Path(folder)/'request.json';request.write_text(json.dumps(REQUEST))
            args=[sys.executable,str(root/'assurance.py'),'--store',str(Path(folder)/'jobs.sqlite')]
            def call(*command):
                return json.loads(subprocess.check_output([*args,*command],cwd=root,text=True))
            job=call('prepare-campaign',str(request))
            self.assertEqual(job['status'],'PREPARED')
            self.assertEqual(call('history')['jobs'][0]['kind'],'campaign')
            self.assertEqual(call('approve',job['job_id'],'--digest',job['plan_sha256'])['status'],'COMPLETE')
            for kind in ('csv','md'):
                out=Path(folder)/('report.'+kind)
                call('export',job['job_id'],'--format',kind,'--out',str(out))
                self.assertGreater(out.stat().st_size,100)

    def test_campaign_approval_progress_restore_and_history(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'runs.sqlite'
            store=WorkflowStore(path)
            original=store.prepare({'duration_seconds':60},{})
            self.assertTrue(hasattr(store,'prepare_campaign'),'Campaign preparation must be implemented')
            job=store.prepare_campaign(REQUEST)
            self.assertEqual(job['status'],'PREPARED')
            self.assertEqual(job['kind'],'campaign')
            self.assertIsNone(store.get(job['job_id'],True)['result'])
            with self.assertRaises(ValueError):store.approve(job['job_id'],'incorrect',background=False)
            store.approve(job['job_id'],job['plan_sha256'],background=False)
            complete=store.get(job['job_id'],True)
            self.assertEqual(complete['status'],'COMPLETE',complete.get('error'))
            self.assertEqual(complete['progress']['completed_runs'],8)
            self.assertEqual(len(complete['result']['runs']),8)
            history=store.list_jobs(limit=2)
            self.assertEqual(history['total'],2)
            self.assertEqual(history['jobs'][0]['job_id'],job['job_id'])
            self.assertNotIn('result',history['jobs'][0])
            self.assertEqual(history['jobs'][1]['job_id'],original['job_id'])
            store.close()
            reopened=WorkflowStore(path)
            self.assertEqual(reopened.get(job['job_id'],True)['result'],complete['result'])
            reopened.close()

    def test_invalid_campaign_and_history_bounds_fail_without_new_jobs(self):
        with tempfile.TemporaryDirectory() as folder:
            store=WorkflowStore(Path(folder)/'runs.sqlite')
            self.assertTrue(hasattr(store,'list_jobs'),'Bounded history must be implemented')
            for limit in (0,65,True,'20'):
                with self.assertRaises(ValueError):store.list_jobs(limit)
            for bad in ({'arbitrary_tool':'shell'},{**REQUEST,'seeds':[1,1]}):
                with self.assertRaises(ValueError):store.prepare_campaign(bad)
            self.assertEqual(store.list_jobs()['total'],0)
            job=store.prepare_campaign(REQUEST);store.cancel(job['job_id'])
            self.assertEqual(store.get(job['job_id'])['status'],'CANCELLED')
            self.assertIsNone(store.get(job['job_id'],True)['result'])
            store.close()
