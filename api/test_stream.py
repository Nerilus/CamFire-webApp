import httpx

url = "http://root:root@192.168.1.90/axis-cgi/mjpg/video.cgi"
try:
    with httpx.Client() as client:
        with client.stream("GET", url, timeout=10.0) as response:
            print(f"Status: {response.status_code}")
            print(f"Headers: {response.headers}")
            
            bytes_buffer = b''
            count = 0
            for chunk in response.iter_bytes():
                bytes_buffer += chunk
                a = bytes_buffer.find(b'\xff\xd8')
                b = bytes_buffer.find(b'\xff\xd9')
                if a != -1 and b != -1:
                    print(f"Found frame! a={a}, b={b}, len={b-a}")
                    bytes_buffer = bytes_buffer[b+2:]
                    count += 1
                    if count >= 3:
                        break
            if count == 0:
                print(f"No frames found. Buffer starts with: {bytes_buffer[:100]}")
except Exception as e:
    print(f"Error: {e}")
