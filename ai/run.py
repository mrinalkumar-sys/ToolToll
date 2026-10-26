import uvicorn
import os
import sys

# Ensure the root directory is on the python search path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

if __name__ == "__main__":
    print("=" * 60)
    print("  Starting ToolToll AI Service on http://127.0.0.1:8001")
    print("  Interactive Docs: http://127.0.0.1:8001/docs")
    print("  Health Status:    http://127.0.0.1:8001/health")
    print("=" * 60)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)
