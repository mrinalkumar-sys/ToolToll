"""ToolToll Unified Runner
Launches both the FastAPI backend and Vite React development server concurrently.
"""
import subprocess
import sys
import time

def main():
    print("=" * 60)
    print("  ToolToll - AI-Powered Pay-Per-Use API Marketplace")
    print("=" * 60)
    print("Starting FastAPI Backend on http://127.0.0.1:8090...")
    backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8090"])

    time.sleep(1.5)

    print("Starting React Frontend on http://127.0.0.1:5200...")
    frontend = subprocess.Popen(["npm", "run", "dev"], shell=True)

    print("\n[OK] Servers started successfully!")
    print("Dashboard: http://127.0.0.1:5200")
    print("API Docs:  http://127.0.0.1:8090/docs")
    print("\nPress Ctrl+C to terminate both servers.")

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        backend.terminate()
        frontend.terminate()
        backend.wait()
        frontend.wait()
        print("Done.")

if __name__ == "__main__":
    main()
