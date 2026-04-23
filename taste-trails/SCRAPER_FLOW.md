# Scraper Flow

## Stages

1. **Input Normalization**
   - Purpose: Clean and standardize input (URL, name)
   - Input: Raw user/menu input
   - Output: Normalized input
   - Failure: Invalid/empty input

2. **Source Resolver**
   - Purpose: Identify menu source (website, aggregator)
   - Input: Normalized input
   - Output: Source type & URL
   - Failure: Source not found

3. **Scraper Agent**
   - Purpose: Fetch and parse menu data
   - Input: Source URL/type
   - Output: Raw menu data
   - Failure: Network, parse, or block errors

4. **Data Validation & Cleaning**
   - Purpose: Ensure menu data is usable
   - Input: Raw menu data
   - Output: Cleaned, structured menu
   - Failure: Invalid/empty/partial data

5. **Confidence Scoring**
   - Purpose: Score scrape quality (0-1000)
   - Input: Cleaned menu
   - Output: Confidence score
   - Failure: Score < threshold (e.g. 422)

6. **Persistence**
   - Purpose: Save menu to DB
   - Input: Cleaned menu, score
   - Output: DB record
   - Failure: DB error, low confidence

## Debugging Guide
If 0 items returned, check stages in this order:
1. Input normalization
2. Source resolver
3. Scraper agent
4. Data validation
5. Confidence scoring
6. Persistence
