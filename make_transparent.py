from PIL import Image
import os

base_path = r"C:\Users\DSC\Desktop\Google Antigravity\보조기기 검색"
files = ["icon-v5-192.png", "icon-v5-512.png"]
output_prefix = "icon-v6"

def make_transparent(img_path, out_path):
    img = Image.open(img_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    
    newData = []
    # Assuming the background is white (255, 255, 255)
    # We will make strictly white pixels transparent. 
    # Can adjust tolerance if needed.
    for item in datas:
        # Check for white (or very close to white)
        if item[0] > 250 and item[1] > 250 and item[2] > 250:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(out_path, "PNG")
    print(f"Saved {out_path}")

for f in files:
    input_path = os.path.join(base_path, f)
    # create output filename: replace v5 with v6
    output_filename = f.replace("v5", "v6")
    output_path = os.path.join(base_path, output_filename)
    
    try:
        make_transparent(input_path, output_path)
    except Exception as e:
        print(f"Error processing {f}: {e}")
