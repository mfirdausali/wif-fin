# Docker/ECS PDF Service HTTPS Solution

## Current Setup Discovered ✅

Your PDF service is running as a **Docker container** on AWS ECS:

| Component | Value |
|-----------|-------|
| **Deployment Type** | AWS ECS (Elastic Container Service) |
| **Cluster** | `wif-finance-cluster` |
| **Service** | `wif-pdf-service` |
| **Container Image** | `387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service` |
| **Task Status** | ✅ Running |
| **Load Balancer** | ❌ None (direct EC2 port mapping) |
| **Current Endpoint** | `http://pdf.wifjapan.com:3001` |

## The Problem

Your containerized PDF service is accessed directly without a load balancer:
```
User Browser (HTTPS) → pdf.wifjapan.com:3001 (HTTP) → ECS Task on EC2
```

Browsers block this "mixed content" connection.

## Solutions for Dockerized PDF Service

### Solution 1: Add Application Load Balancer (RECOMMENDED) ⭐

**Why this is best:**
- AWS-native HTTPS termination
- Automatic SSL certificate via ACM
- Auto-scaling ready
- Production-grade

**Steps:**

#### Step 1: Create Target Group
```bash
aws elbv2 create-target-group \
  --name pdf-service-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id $(aws ec2 describe-vpcs --region ap-southeast-1 --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text) \
  --target-type ip \
  --health-check-path /health \
  --region ap-southeast-1
```

#### Step 2: Request SSL Certificate
```bash
aws acm request-certificate \
  --domain-name pdf.wifjapan.com \
  --validation-method DNS \
  --region ap-southeast-1
```

#### Step 3: Create Application Load Balancer
```bash
# Get subnet IDs
SUBNET_IDS=$(aws ec2 describe-subnets --region ap-southeast-1 \
  --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[*].SubnetId' --output text | tr '\t' ' ')

# Create ALB
aws elbv2 create-load-balancer \
  --name pdf-service-alb \
  --subnets $SUBNET_IDS \
  --security-groups $(aws ec2 describe-security-groups --region ap-southeast-1 --filters "Name=group-name,Values=default" --query 'SecurityGroups[0].GroupId' --output text) \
  --region ap-southeast-1
```

#### Step 4: Update ECS Service
```bash
# Update service to use load balancer
aws ecs update-service \
  --cluster wif-finance-cluster \
  --service wif-pdf-service \
  --load-balancers targetGroupArn=TARGET_GROUP_ARN,containerName=pdf-service,containerPort=3001 \
  --region ap-southeast-1
```

---

### Solution 2: nginx Sidecar Container (Alternative)

Add an nginx container as HTTPS termination in the same task.

**Update task definition:**
```json
{
  "containerDefinitions": [
    {
      "name": "pdf-service",
      "image": "387158738611.dkr.ecr.ap-southeast-1.amazonaws.com/wif-pdf-service",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ]
    },
    {
      "name": "nginx-ssl",
      "image": "nginx:alpine",
      "portMappings": [
        {
          "containerPort": 443,
          "hostPort": 3001,
          "protocol": "tcp"
        }
      ],
      "links": ["pdf-service"],
      "mountPoints": [
        {
          "sourceVolume": "ssl-certs",
          "containerPath": "/etc/nginx/ssl"
        }
      ]
    }
  ]
}
```

---

### Solution 3: Simple nginx on EC2 Host (FASTEST) 🚀

Since your ECS task is running on EC2, just install nginx on the EC2 host:

**This works because:**
- Container maps port 3001 to host
- nginx on host listens on 443
- nginx proxies to localhost:3001

**Commands** (same as before):
```bash
# SSH or use EC2 Instance Connect
sudo yum install -y nginx certbot python3-certbot-nginx

# Configure nginx
sudo tee /etc/nginx/conf.d/pdf-service.conf > /dev/null <<'EOF'
server {
    listen 443 ssl http2;
    server_name pdf.wifjapan.com;

    ssl_certificate /etc/letsencrypt/live/pdf.wifjapan.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pdf.wifjapan.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Get certificate
sudo certbot --nginx -d pdf.wifjapan.com --email admin@wifjapan.com --agree-tos -n

# Test
curl https://pdf.wifjapan.com:3001/health
```

---

## Recommended Approach

**For now (Quick fix - 5 minutes):**
Use Solution 3 - nginx on EC2 host

**For production (Better - 30 minutes):**
Use Solution 1 - Application Load Balancer

## Which Port to Use?

After SSL setup, you have options:

**Option A: Port 3001 with HTTPS**
```
VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com:3001
```
Configure nginx to listen on port 3001 for HTTPS

**Option B: Standard HTTPS port (443)**
```
VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com
```
Configure nginx to listen on port 443, no port number needed

**Option C: Custom path**
```
VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com/pdf
```
Use ALB with path routing

## Quick Fix Right Now

Since your container is already running and accessible on port 3001:

1. **Use EC2 Instance Connect** to access the EC2 host
2. **Run the nginx + certbot setup** from COPY_PASTE_SSL_SETUP.txt
3. **Configure nginx to listen on 443 and proxy to localhost:3001**
4. **Update frontend** to use `https://pdf.wifjapan.com:443` or `https://pdf.wifjapan.com`

The containerized app will keep running unchanged - nginx just adds HTTPS in front!

---

## After HTTPS is Working

Update `.env.production`:
```bash
# Option 1: Custom port
VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com:3001

# Option 2: Standard HTTPS (if nginx on 443)
VITE_PDF_SERVICE_URL=https://pdf.wifjapan.com
```

Then rebuild and deploy frontend.

---

## Next Steps

**Choose your approach:**

1. **Quick fix**: nginx on EC2 host (follow COPY_PASTE_SSL_SETUP.txt)
2. **Production**: Set up ALB with ACM certificate

Which would you like to do?
