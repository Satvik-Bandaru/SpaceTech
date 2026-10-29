from pathlib import Path
import tempfile
import unittest

from spacecraft_lab.assurance.workflow import WorkflowStore
from spacecraft_lab.assurance.contracts import digest
import json


class WorkflowTests(unittest.TestCase):
    def test_explicit_digest_approval_and_durable_result(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'jobs.sqlite';store=WorkflowStore(path)
            plan=store.prepare({'duration_seconds':120},{'probe_unsafe':True})
            self.assertEqual(plan['status'],'PREPARED')
            with self.assertRaises(ValueError):store.approve(plan['job_id'],'bad',background=False)
            self.assertEqual(store.get(plan['job_id'])['status'],'PREPARED')
            store.approve(plan['job_id'],plan['plan_sha256'],background=False)
            result=store.get(plan['job_id'],include_result=True)
            self.assertEqual(result['status'],'COMPLETE')
            self.assertEqual(result['result']['checks']['violations'],[])
            store.close()
            restored=WorkflowStore(path)
            self.assertEqual(restored.get(plan['job_id'],include_result=True)['result'],result['result'])
            restored.close()

    def test_prepared_work_can_be_cancelled_without_execution(self):
        with tempfile.TemporaryDirectory() as folder:
            store=WorkflowStore(Path(folder)/'jobs.sqlite')
            job=store.prepare({'duration_seconds':120},{})
            store.cancel(job['job_id'])
            self.assertEqual(store.get(job['job_id'])['status'],'CANCELLED')
            with self.assertRaises(ValueError):store.approve(job['job_id'],job['plan_sha256'],background=False)
            store.close()

    def test_bad_inputs_and_identifiers_do_not_create_jobs(self):
        with tempfile.TemporaryDirectory() as folder:
            store=WorkflowStore(Path(folder)/'jobs.sqlite')
            with self.assertRaises(ValueError):store.prepare({'duration_seconds':0},{})
            with self.assertRaises(ValueError):store.get('../arbitrary-file')
            store.close()

    def test_observer_store_does_not_interrupt_another_live_owner(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'jobs.sqlite';owner=WorkflowStore(path)
            job=owner.prepare({'duration_seconds':120},{})
            with owner._db() as db:db.execute('UPDATE jobs SET status=?,owner_id=? WHERE id=?',('QUEUED',owner.owner_id,job['job_id']))
            observer=WorkflowStore(path)
            self.assertEqual(observer.get(job['job_id'])['status'],'QUEUED')
            observer.close()
            self.assertEqual(owner.get(job['job_id'])['status'],'QUEUED')
            owner.cancel(job['job_id']);owner.close()

    def test_stale_source_approval_and_corrupt_result_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            store=WorkflowStore(Path(folder)/'jobs.sqlite')
            job=store.prepare({'duration_seconds':120},{})
            plan=job['plan'];plan['implementation_sha256']['engineering/model.py']='0'*64
            with store._db() as db:db.execute('UPDATE jobs SET plan=?,plan_sha=? WHERE id=?',(json.dumps(plan),digest(plan),job['job_id']))
            with self.assertRaises(ValueError):store.approve(job['job_id'],digest(plan),background=False)
            clean=store.prepare({'duration_seconds':120},{})
            store.approve(clean['job_id'],clean['plan_sha256'],background=False)
            with store._db() as db:db.execute('UPDATE jobs SET result=? WHERE id=?',('{"forged":true}',clean['job_id']))
            with self.assertRaises(ValueError):store.get(clean['job_id'],include_result=True)
            store.close()
