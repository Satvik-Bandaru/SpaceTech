from pathlib import Path
import shutil
import subprocess
import unittest


class SceneMaterialTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node needed for scene GPU boundary checks')
    def test_material_upload_shadow_commands_and_fallback_lifecycle(self):
        root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            ['node', 'tests/frontend-materials.test.cjs'], cwd=root,
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
