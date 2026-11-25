def encrypt(text, key):
    """평문의 모든 ASCII 바이트에 같은 8비트 키로 XOR을 적용합니다."""
    data = text.encode("ascii")
    encrypted = bytearray()
    for value in data:
        encrypted.append(value ^ key)
    return encrypted