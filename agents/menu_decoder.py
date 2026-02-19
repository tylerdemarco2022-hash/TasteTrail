from crewai import Agent


decoder_agent = Agent(
    name="Menu Decoder",
    role="Convert raw menu text into structured JSON format",
    goal="Take messy menu data and transform it into a clean format with name, price, and category",
    backstory="You organize restaurant menus into usable data for apps",
)
