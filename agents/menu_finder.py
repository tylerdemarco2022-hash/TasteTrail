from crewai import Agent
from langchain.tools import Tool
from bs4 import BeautifulSoup
import requests


def search_menu(query: str) -> str:
    """Lightweight DuckDuckGo HTML search to find a menu URL for the query."""
    search_url = "https://duckduckgo.com/html"
    params = {"q": f"{query} menu", "t": "h_", "ia": "web"}
    headers = {"User-Agent": "Mozilla/5.0 (menu-finder)"}

    resp = requests.get(search_url, params=params, headers=headers, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Pick the first plausible menu link
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(" ", strip=True).lower()
        if "menu" in href.lower() or "menu" in text or href.lower().endswith(".pdf"):
            return href

    # Fallback to any first result link
    first = soup.find("a", href=True)
    if first:
        return first.get("href")
    return ""


def scrape_menu(url: str) -> str:
    """Fetches page HTML and returns text content; minimal cleanup."""
    response = requests.get(url, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    return soup.get_text(separator="\n", strip=True)


search_tool = Tool(
    name="Menu Search",
    func=search_menu,
    description="Finds a menu URL for a restaurant using web search",
)

scrape_tool = Tool(
    name="Menu Scraper",
    func=scrape_menu,
    description="Scrapes menu text from a given restaurant URL",
)

menu_agent = Agent(
    name="Menu Finder",
    role="Search the web for restaurant menus and extract the raw menu HTML or text",
    goal="Find menus from restaurant websites and return the content exactly as found",
    backstory="You browse restaurant sites and pull menu data for processing",
    tools=[search_tool, scrape_tool],
)
