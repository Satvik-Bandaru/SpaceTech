from pathlib import Path
import shutil
import subprocess
import unittest


class DetailedSpacecraftGeometryTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node needed for scene geometry checks")
    def test_deterministic_bounded_cached_spacecraft_geometry(self):
        root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            ["node", "tests/scene-model.test.cjs"], cwd=root,
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
