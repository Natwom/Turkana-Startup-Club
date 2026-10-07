# services/qr.py
import io
import qrcode


def qr_png(data: str, box_size: int = 8) -> bytes:
    img = qrcode.make(data, box_size=box_size)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()