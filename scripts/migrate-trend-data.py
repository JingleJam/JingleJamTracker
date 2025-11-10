import datetime
import json
import requests
import os

INPUT_URL = "https://dashboard.jinglejam.co.uk/api/graph/current"
OUTPUT_FILE = "../kv/trends-previous.json"
YEAR = 2024

def convert_data(data):
    result = []
    for item in data:
        # Convert from milliseconds since epoch to UTC datetime
        dt = datetime.datetime.fromtimestamp(item["date"] / 1000, tz=datetime.timezone.utc)
        # Format as ISO 8601 without timezone info (e.g., 2023-12-15T10:10:00)
        timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S")

        result.append({
            "timestamp": timestamp,
            "year": YEAR,
            "amountPounds": round(item["p"], 2),
            "amountDollars": round(item["d"], 2)
        })
    return result

def main():
    # Fetch data from the remote URL
    response = requests.get(INPUT_URL)
    response.raise_for_status()
    data = response.json()

    converted = convert_data(data)

    # Load existing file if it exists
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            try:
                existing_data = json.load(f)
            except json.JSONDecodeError:
                existing_data = []
    else:
        existing_data = []

    # Append new data
    existing_data.extend(converted)

    # Write back to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=4)

    print(f"✅ Appended {len(converted)} entries to {OUTPUT_FILE} (timestamps in GMT, no timezone suffix)")

if __name__ == "__main__":
    main()
