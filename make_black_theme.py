from PIL import Image
import os

base_path = r"C:\Users\DSC\Desktop\Google Antigravity\보조기기 검색"
files = ["icon-v5-192.png", "icon-v5-512.png"]

def make_black_theme(img_path, out_path):
    img = Image.open(img_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    
    newData = []
    
    # 목표:
    # 1. 흰색 배경 (255, 255, 255) -> 검정색 (0, 0, 0)
    # 2. 검정 테두리 (0, 0, 0) -> 흰색 (255, 255, 255)
    
    for item in datas:
        r, g, b, a = item
        
        # 흰색에 가까운 픽셀 (배경) -> 검정색으로 변경
        if r > 200 and g > 200 and b > 200:
            newData.append((0, 0, 0, 255))
        # 검정색에 가까운 픽셀 (테두리/글자) -> 흰색으로 변경
        elif r < 50 and g < 50 and b < 50:
            newData.append((255, 255, 255, 255))
        else:
            # 그 외 색상은 유지 (또는 필요시 조정)
            newData.append(item)
            
    img.putdata(newData)
    img.save(out_path, "PNG")
    print(f"저장 완료: {out_path}")

for f in files:
    input_path = os.path.join(base_path, f)
    output_filename = f.replace("v5", "v7")
    output_path = os.path.join(base_path, output_filename)
    
    try:
        make_black_theme(input_path, output_path)
    except Exception as e:
        print(f"처리 중 오류 발생 {f}: {e}")
