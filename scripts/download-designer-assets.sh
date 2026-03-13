#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AVATAR_DIR="$ROOT_DIR/public/images/designers/avatars"
PROJECT_DIR="$ROOT_DIR/public/images/designers/projects"

mkdir -p "$AVATAR_DIR" "$PROJECT_DIR"

download() {
  local url="$1"
  local output="$2"
  curl -fL "$url" -o "$output"
}

download "https://images.pexels.com/photos/20355553/pexels-photo-20355553.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/omar-farouk.jpg"
download "https://images.pexels.com/photos/33261949/pexels-photo-33261949.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/daniel-rana.jpg"
download "https://images.pexels.com/photos/31085325/pexels-photo-31085325.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/salma-nasser.jpg"
download "https://images.pexels.com/photos/28559864/pexels-photo-28559864.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/hana-idris.jpg"
download "https://images.pexels.com/photos/36363695/pexels-photo-36363695.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/mariam-kassem.jpg"
download "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/layla-haddad.jpg"
download "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/yousef-karim.jpg"
download "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/noor-rahman.jpg"
download "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/tariq-mansour.jpg"
download "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/amira-safwan.jpg"
download "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/karim-dawoud.jpg"
download "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/sara-elias.jpg"
download "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/adam-hakim.jpg"
download "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/leena-aziz.jpg"
download "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=800" "$AVATAR_DIR/zayn-abbas.jpg"

download "https://images.pexels.com/photos/15242038/pexels-photo-15242038.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/salma-nasser-01.jpg"
download "https://images.pexels.com/photos/5353892/pexels-photo-5353892.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/salma-nasser-02.jpg"
download "https://images.pexels.com/photos/32269122/pexels-photo-32269122.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/salma-nasser-03.jpg"
download "https://images.pexels.com/photos/28681145/pexels-photo-28681145.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/salma-nasser-04.jpg"
download "https://images.pexels.com/photos/8753786/pexels-photo-8753786.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/salma-nasser-05.jpg"

download "https://images.pexels.com/photos/34951489/pexels-photo-34951489.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/omar-farouk-01.jpg"
download "https://images.pexels.com/photos/34538286/pexels-photo-34538286.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/omar-farouk-02.jpg"
download "https://images.pexels.com/photos/32025946/pexels-photo-32025946.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/omar-farouk-03.jpg"
download "https://images.pexels.com/photos/30705322/pexels-photo-30705322.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/omar-farouk-04.jpg"
download "https://images.pexels.com/photos/34675226/pexels-photo-34675226.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/omar-farouk-05.jpg"

download "https://images.pexels.com/photos/34538290/pexels-photo-34538290.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/hana-idris-01.jpg"
download "https://images.pexels.com/photos/34538295/pexels-photo-34538295.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/hana-idris-02.jpg"
download "https://images.pexels.com/photos/32269126/pexels-photo-32269126.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/hana-idris-03.jpg"
download "https://images.pexels.com/photos/32025920/pexels-photo-32025920.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/hana-idris-04.jpg"
download "https://images.pexels.com/photos/20599767/pexels-photo-20599767.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/hana-idris-05.jpg"

download "https://images.pexels.com/photos/35896200/pexels-photo-35896200.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/daniel-rana-01.jpg"
download "https://images.pexels.com/photos/7166942/pexels-photo-7166942.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/daniel-rana-02.jpg"
download "https://images.pexels.com/photos/33167283/pexels-photo-33167283.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/daniel-rana-03.jpg"
download "https://images.pexels.com/photos/7601156/pexels-photo-7601156.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/daniel-rana-04.jpg"
download "https://images.pexels.com/photos/35018333/pexels-photo-35018333.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/daniel-rana-05.jpg"

download "https://images.pexels.com/photos/29923543/pexels-photo-29923543.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/mariam-kassem-01.jpg"
download "https://images.pexels.com/photos/10827348/pexels-photo-10827348.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/mariam-kassem-02.jpg"
download "https://images.pexels.com/photos/31606505/pexels-photo-31606505.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/mariam-kassem-03.jpg"
download "https://images.pexels.com/photos/32025945/pexels-photo-32025945.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/mariam-kassem-04.jpg"
download "https://images.pexels.com/photos/4119847/pexels-photo-4119847.jpeg?auto=compress&cs=tinysrgb&w=1600" "$PROJECT_DIR/mariam-kassem-05.jpg"

echo "Downloaded designer assets to $AVATAR_DIR and $PROJECT_DIR"
