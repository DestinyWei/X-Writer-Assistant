import sys
import os

# 确保项目根目录在 Python path 中
sys.path.insert(0, '/Users/howe/Documents/X-Writer-Assistant')
os.chdir('/Users/howe/Documents/X-Writer-Assistant')

import uvicorn
uvicorn.run('backend.main:app', host='0.0.0.0', port=8000)
