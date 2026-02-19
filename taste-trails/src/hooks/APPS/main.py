from crewai import Task, Crew
from agents.menu_finder import menu_agent
from agents.menu_decoder import decoder_agent

# Define tasks
find_menu_url = Task(
    description="Search the web and return the best menu URL for 'Burtons Grill Boston menu'. Respond with a single URL only.",
    agent=menu_agent,
)

scrape_menu = Task(
    description="Scrape the menu text from the URL found in the previous task and return raw text only.",
    agent=menu_agent,
)

decode_menu = Task(
    description=(
        "Convert the scraped menu text into JSON grouped by categories. "
        "Return JSON only, shaped as {Category: [{name, price}]}."
    ),
    agent=decoder_agent,
)

# Wire crew
crew = Crew(
    agents=[menu_agent, decoder_agent],
    tasks=[find_menu_url, scrape_menu, decode_menu],
)

if __name__ == "__main__":
    result = crew.kickoff()
    print(result)
