"""Connect to the mock bridge and print the first 4 messages."""
import asyncio

import websockets

URL = "ws://localhost:8000/ws/stream?speed=5"


async def main():
    async with websockets.connect(URL) as ws:
        for _ in range(4):
            print(await asyncio.wait_for(ws.recv(), timeout=10))


asyncio.run(main())
