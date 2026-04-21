#!/bin/bash
# Generate TLS certificates for API Gateway
# Supports both self-signed (development) and Let's Encrypt (production)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
NAMESPACE="ingress"
CERT_DIR="/tmp/fitquest-certs"
DOMAIN="${DOMAIN:-api.fitquest.com}"
CERT_NAME="fitquest-tls"

# Parse arguments
CERT_TYPE="self-signed"
while [[ $# -gt 0 ]]; do
    case $1 in
        --self-signed)
            CERT_TYPE="self-signed"
            shift
            ;;
        --letsencrypt)
            CERT_TYPE="letsencrypt"
            shift
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}Generating TLS Certificates${NC}"
echo "======================================"
echo "Certificate Type: $CERT_TYPE"
echo "Domain: $DOMAIN"
echo ""

# Create certificate directory
mkdir -p "$CERT_DIR"

if [ "$CERT_TYPE" = "self-signed" ]; then
    echo -e "${YELLOW}Generating self-signed certificate...${NC}"
    
    # Generate private key
    openssl genrsa -out "$CERT_DIR/tls.key" 2048
    
    # Generate certificate
    openssl req -new -x509 -key "$CERT_DIR/tls.key" -out "$CERT_DIR/tls.crt" -days 365 \
        -subj "/C=US/ST=State/L=City/O=FitQuest/CN=$DOMAIN"
    
    echo -e "${GREEN}Self-signed certificate generated${NC}"
    
elif [ "$CERT_TYPE" = "letsencrypt" ]; then
    echo -e "${YELLOW}Setting up Let's Encrypt certificate...${NC}"
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${RED}certbot not found. Please install certbot.${NC}"
        echo "On macOS: brew install certbot"
        echo "On Ubuntu: sudo apt-get install certbot"
        exit 1
    fi
    
    # Generate certificate using certbot
    certbot certonly --standalone -d "$DOMAIN" -d "*.$DOMAIN" \
        --non-interactive --agree-tos --email admin@fitquest.com \
        --cert-path "$CERT_DIR/tls.crt" --key-path "$CERT_DIR/tls.key"
    
    echo -e "${GREEN}Let's Encrypt certificate generated${NC}"
fi

# Create Kubernetes secret
echo -e "${YELLOW}Creating Kubernetes secret...${NC}"

# Delete existing secret if it exists
kubectl delete secret $CERT_NAME -n $NAMESPACE --ignore-not-found=true

# Create new secret
kubectl create secret tls $CERT_NAME \
    --cert="$CERT_DIR/tls.crt" \
    --key="$CERT_DIR/tls.key" \
    -n $NAMESPACE

echo -e "${GREEN}Kubernetes secret created${NC}"

# Display certificate information
echo ""
echo -e "${YELLOW}Certificate Information:${NC}"
openssl x509 -in "$CERT_DIR/tls.crt" -noout -text | grep -E "Subject:|Issuer:|Not Before|Not After"

# Cleanup
rm -rf "$CERT_DIR"

echo ""
echo -e "${GREEN}Certificate setup complete!${NC}"
