import os
import sys
from dotenv import load_dotenv

load_dotenv()

from src.image_gen import generate_image_bytes

prompts = {
    "toit": "A beautifully plated pub food spread with a craft beer flight at a microbrewery, vibrant atmosphere, photorealistic",
    "truffles": "A juicy towering American burger with melted cheese, crispy fries on the side, diner style, photorealistic food photography, 4k",
    "meghana": "A steaming hot pot of authentic Hyderabadi Biryani with rich spices, succulent meat, and garnish, top down view, photorealistic"
}

os.makedirs("frontend/public/images", exist_ok=True)

for name, prompt in prompts.items():
    print(f"Generating {name}...")
    img_bytes = generate_image_bytes(prompt)
    if img_bytes:
        with open(f"frontend/public/images/{name}.png", "wb") as f:
            f.write(img_bytes)
        print(f"Saved frontend/public/images/{name}.png")
    else:
        print(f"Failed to generate {name}")
