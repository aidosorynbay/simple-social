from fastapi import FastAPI, HTTPException
from app.schemas import PostCreate, PostResponse
from app.db import Post, get_async_session, create_db_and_tables
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastApi):
    await create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

