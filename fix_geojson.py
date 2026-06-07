#!/usr/bin/env python3
"""
Script to fix bairros_slz.json GeoJSON:
1. Remove non-existent neighborhoods (Vila Riod, Kiola, Estiva, Cohab Variante 1, Residencial Pirâmide)
2. Add missing important neighborhoods with approximate polygons (Cohajap, Turu, São Marcos, etc.)
3. Fix Divinéia coordinates
"""
import json
import math
import copy

INPUT_FILE = "frontend/public/bairros_slz.json"
OUTPUT_FILE = "frontend/public/bairros_slz.json"

# Load existing GeoJSON
with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    geojson = json.load(f)

print(f"Original features: {len(geojson['features'])}")

# ============================================================
# 1. REMOVE non-existent/problematic neighborhoods
# ============================================================
REMOVE_NAMES = {
    'Vila Riod',
    'Kiola',
    'Estiva',
    'Cohab (Variante 1)',
    'Residencial Pirâmide',
    'Upaon-Açu',
}

geojson['features'] = [
    f for f in geojson['features']
    if f['properties'].get('name') not in REMOVE_NAMES
]

print(f"After removal: {len(geojson['features'])}")

# ============================================================
# 2. Helper: Create a hexagonal polygon around a center point
# ============================================================
def create_hex_polygon(center_lat, center_lon, radius_km=0.6, num_points=6):
    """Create a regular polygon (hexagon by default) around center."""
    coords = []
    for i in range(num_points + 1):  # +1 to close the polygon
        angle = math.radians(60 * (i % num_points) - 30)
        # Approximate km to degrees (1 degree lat ~ 111km, lon adjusted by cos(lat))
        dlat = (radius_km / 111.0) * math.cos(angle)
        dlon = (radius_km / (111.0 * math.cos(math.radians(center_lat)))) * math.sin(angle)
        coords.append([round(center_lon + dlon, 6), round(center_lat + dlat, 6)])
    return coords

def create_feature(name, fid, center_lat, center_lon, radius_km=0.6):
    """Create a GeoJSON feature with a hexagonal polygon."""
    return {
        "type": "Feature",
        "properties": {
            "name": name,
            "id": fid
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [create_hex_polygon(center_lat, center_lon, radius_km)]
        }
    }

# ============================================================
# 3. ADD missing important neighborhoods
# ============================================================
# Check which names already exist
existing_names = {f['properties'].get('name') for f in geojson['features']}

MISSING_NEIGHBORHOODS = [
    # (name, id, lat, lon, radius_km)
    ('Cohajap', 'cohajap', -2.5085, -44.2458, 0.55),
    ('Ponta d\'Areia', 'ponta_dareia', -2.4975, -44.3150, 0.45),
    ('Turu', 'turu', -2.5150, -44.2200, 0.7),
    ('São Marcos', 'sao_marcos', -2.4928, -44.2936, 0.45),
    ('Ponta do Farol', 'ponta_do_farol', -2.4921, -44.2920, 0.35),
    ('Jardim Eldorado', 'jardim_eldorado', -2.5050, -44.2310, 0.45),
    ('Altos do Calhau', 'altos_do_calhau', -2.5050, -44.2680, 0.5),
    ('Aurora', 'aurora', -2.5490, -44.2290, 0.4),
    ('Planalto Anil', 'planalto_anil', -2.5380, -44.2140, 0.45),
    ('Divinéia', 'divineia', -2.5060, -44.2740, 0.35),
]

for name, fid, lat, lon, radius in MISSING_NEIGHBORHOODS:
    if name not in existing_names:
        feature = create_feature(name, fid, lat, lon, radius)
        geojson['features'].append(feature)
        print(f"  Added: {name} at ({lat}, {lon})")
    elif name in ['Divinéia', 'Cohajap', 'Ponta d\'Areia']:
        # Update existing polygons with correct location
        for f in geojson['features']:
            if f['properties'].get('name') == name:
                f['geometry']['coordinates'] = [create_hex_polygon(lat, lon, radius)]
                print(f"  Updated polygon: {name} to ({lat}, {lon})")
                break

print(f"Final features: {len(geojson['features'])}")

# ============================================================
# 4. SAVE updated GeoJSON
# ============================================================
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

print(f"\nSaved to {OUTPUT_FILE}")
print("Done!")
