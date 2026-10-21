"""ทดสอบตัวโหลดข้อมูลเทรน — กันบั๊ก label เลื่อนแถว (Wisesight รอบแรกของ v4 ผิดราว 60%)"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "train"))

import build_dataset  # noqa: E402


class WisesightLoaderTest(unittest.TestCase):
    def _write(self, d: str, name: str, content: str) -> None:
        with open(os.path.join(d, name), "w", encoding="utf-8", newline="") as f:
            f.write(content)

    def test_special_line_separators_inside_text_do_not_shift_labels(self):
        # \x0c /   อยู่ในข้อความจริงของ Wisesight — str.splitlines() ตัดตรงนั้นแล้ว label เลื่อน
        with tempfile.TemporaryDirectory() as d:
            self._write(d, "ws_train.txt", "ดีมาก\x0cจริงๆ\nแย่สุด เลย\nถามหน่อย\n")
            self._write(d, "ws_train_label.txt", "pos\nneg\nq\n")
            rows = build_dataset.load_wisesight(d)
        self.assertEqual([r["label"] for r in rows], ["pos", "neg", "neutral"])
        self.assertEqual(rows[0]["text"], "ดีมาก\x0cจริงๆ")

    def test_mismatched_files_fail_loudly(self):
        with tempfile.TemporaryDirectory() as d:
            self._write(d, "ws_train.txt", "a\nb\n")
            self._write(d, "ws_train_label.txt", "pos\n")
            with self.assertRaises(SystemExit):
                build_dataset.load_wisesight(d)

    def test_crlf_files(self):
        with tempfile.TemporaryDirectory() as d:
            self._write(d, "ws_train.txt", "ดี\r\nแย่\r\n")
            self._write(d, "ws_train_label.txt", "pos\r\nneg\r\n")
            rows = build_dataset.load_wisesight(d)
        self.assertEqual([(r["text"], r["label"]) for r in rows], [("ดี", "pos"), ("แย่", "neg")])


if __name__ == "__main__":
    unittest.main()
