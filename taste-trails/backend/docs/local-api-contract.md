# Local API Contract (Frozen)

## GET /health
Response:
```
{ "status": "ok" }
```

## POST /auth/login
Request:
```
{ "email": "string", "password": "string" }
```
Response:
```
{ "user": { "id": "string", "email": "string" }, "token": "string" }
```

## POST /auth/register
Request:
```
{ "email": "string", "password": "string" }
```
Response:
```
{ "user": { "id": "string", "email": "string" }, "token": "string" }
```

## GET /restaurants
Response:
```
{ "restaurants": [ ... ] }
```

## GET /restaurants/:id/menu
Response:
```
{ "menu_sections": [ ... ], "lastUpdated": "string", "source": "string" }
```

## POST /restaurants/scrape
Request:
```
{ "url": "string" }
```
Response:
```
{ "menu_sections": [ ... ], "confidence": "number" }
```

## Error Response (any endpoint)
```
{ "error": "message" }
```

---

**Do NOT change these shapes during refactor.**