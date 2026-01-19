"""
Простой веб-сервер для разработки Mini App
Для продакшена используйте nginx или другой веб-сервер
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        if self.path == '/':
            self.path = '/webapp/index.html'
        elif not self.path.startswith('/webapp'):
            self.path = '/webapp' + self.path
        return super().do_GET()

def run_server(port=8000):
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f'Сервер запущен на http://localhost:{port}')
    print('Откройте http://localhost:8000/webapp/index.html в браузере')
    print('Для Telegram Mini App используйте ngrok или другой туннель с HTTPS')
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
