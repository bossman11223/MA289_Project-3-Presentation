import os
import plaid
from plaid.api import plaid_api
from plaid.configuration import Configuration
from plaid.api_client import ApiClient
from dotenv import load_dotenv

load_dotenv()

_ENV_MAP = {
    "sandbox":     plaid.Environment.Sandbox,
    "development": plaid.Environment.Development,
    "production":  plaid.Environment.Production,
}


def create_plaid_client() -> plaid_api.PlaidApi:
    env_name = os.getenv("PLAID_ENV", "sandbox").lower()
    configuration = Configuration(
        host=_ENV_MAP.get(env_name, plaid.Environment.Sandbox),
        api_key={
            "clientId": os.getenv("PLAID_CLIENT_ID", ""),
            "secret":   os.getenv("PLAID_SECRET", ""),
        },
    )
    return plaid_api.PlaidApi(ApiClient(configuration))
