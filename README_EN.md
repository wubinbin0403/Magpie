# Magpie - Lightweight Link Collection System

Magpie is a lightweight link collection and display system for saving interesting links encountered during reading. It combines AI-powered automatic analysis, to add category, tags and description to the link, with user confirmation workflows. Share links with others and your future self in a way that is searchable and easy to review!

My personal link collection site at https://onevcat.link is a live example of Magpie in action.

![](https://github.com/user-attachments/assets/c1a270d6-5d6b-468c-8b38-52c7557b614e)

## ✨ Key Features

### 🔗 Link Management
- **Smart Collection**: Quickly save links via browser extension or API
- **AI Analysis**: Automatically extract titles, descriptions, categories, and tags
- **Category Management**: Support for custom categories with preset icons
- **Tag System**: Multi-tag management with tag filtering
- **Search Functionality**: Full-text search with keyword highlighting

### 🎯 Display Features
- **Responsive Design**: Optimized for desktop and mobile devices
- **Category Browsing**: Filter links by categories
- **Timeline View**: Display links in chronological order
- **Reading Time**: Automatically calculate and display estimated reading time

### 🔧 Management Features
- **Admin Panel**: Complete backend management system
- **Link Approval**: Support for manual confirmation or automatic publishing
- **Category Management**: Drag-and-drop sorting with custom icons
- **API Token**: Support for multiple token management
- **Operation Logs**: Comprehensive operation auditing

### 🌐 Extension Support
- **Chrome Extension**: One-click save for current pages
- **API Interface**: RESTful API support
- **SEO Optimization**: Automatic sitemap and RSS feed generation

### Some Screenshots of Dashboard

![](https://github.com/user-attachments/assets/98a5db2b-9b5f-45e0-b8e0-322090adf7cc)

![](https://github.com/user-attachments/assets/9e605fa4-f030-4bf8-9348-0415f2dbde15)

## 🚀 Quick Start

It supports Docker self-hosting deployment.

### Using Docker Deployment (Recommended)

#### 1. Prerequisites
Ensure Docker is installed on your system.

#### 2. Pull the Latest Image
```bash
docker pull ghcr.io/onevcat/magpie:latest
```

#### 3. Start the Container
```bash
# Start with default configuration
docker run -d \
  --name magpie \
  --restart unless-stopped \
  -p 3001:3001 \
  -v ./data:/app/data \
  -e JWT_SECRET="your-super-secret-key" \
  -e BASE_URL="http://localhost:3001" \
  -e NODE_ENV=production \
  ghcr.io/onevcat/magpie:latest
```

#### 4. Access the Application and Setup Admin Password
Open your browser and navigate to: `http://localhost:3001/admin`

### Complete Deployment Example

```bash
# 1. Create data directory
mkdir -p ./data

# 2. Generate a strong JWT secret
export JWT_SECRET=$(openssl rand -base64 32)

# 3. Pull the latest image
docker pull ghcr.io/onevcat/magpie:latest

# 4. Start the container (with OpenAI support)
docker run -d \
  --name magpie \
  --restart unless-stopped \
  -p 3001:3001 \
  -v ./data:/app/data \
  -e JWT_SECRET="$JWT_SECRET" \
  -e OPENAI_API_KEY="sk-your-actual-openai-key" \
  -e BASE_URL="https://links.yourdomain.com" \
  -e NODE_ENV=production \
  ghcr.io/onevcat/magpie:latest

# 5. Check container status
docker ps | grep magpie
```

### Environment Variables Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing key | - | ✅ |
| `PORT` | Service port | `3001` | ❌ |
| `DATA_DIR` | Data directory | `./data` | ❌ |
| `BASE_URL` | Application access URL | `http://localhost:PORT` | ❌ |
| `OPENAI_API_KEY` | OpenAI API key | - | ❌ |
| `OPENAI_BASE_URL` | OpenAI API URL | `https://api.openai.com/v1` | ❌ |

## 📁 Project Structure

```
magpie/
├── apps/
│   ├── web/          # React frontend application
│   └── api/          # Hono.js backend API
├── packages/
│   └── shared/       # Shared TypeScript type definitions
├── extension/        # Chrome browser extension
├── data/            # SQLite database mount point
├── scripts/         # Utility scripts
└── doc/             # Design documentation
```

## 🔧 Development Guide

### Local Development Environment

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build project
pnpm build
```

### Database Operations

```bash
# Reset database (development environment)
pnpm db:reset

# Generate database migrations
pnpm db:generate

# Execute database migrations
pnpm db:migrate

# Open database management interface
pnpm db:studio
```

## 🔌 API Usage

### Authentication Methods

**API Token**: For external API calls
   ```bash
   curl -H "Authorization: Bearer mgp_your_api_token" \
        https://your-magpie-instance.com/api/links
   ```

### Main API Endpoints

- `GET /api/links` - Get link list
- `POST /api/links` - Add new link
- `GET /api/search` - Search links
- `GET /api/stats` - Get statistics
- `GET /api/admin/pending` - Get pending links

## 🛠️ Browser Extension

### Install Extension

1. Build the extension (for development):
   ```bash
   cd extension
   pnpm build
   ```

2. Load extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` directory

**Note**: The extension is also available as a pre-built package. Check the releases page for the latest version.

### Configure Extension

1. Click the extension icon
2. Enter your Magpie instance URL (e.g., `http://localhost:3001`)
3. Enter your API Token
4. Click "Test Connection" to verify configuration

## 📊 Data Persistence

The container automatically creates a data directory and persists the following data:

```
./data/
├── magpie.db             # SQLite database
├── logs/                 # Log files
│   ├── error.log         # Error logs
│   └── combined.log      # Complete logs
└── ...
```

## 🔒 Security Recommendations

1. **Set Strong JWT Secret**: Required for production environments
2. **Use HTTPS**: Enable HTTPS in production
3. **Regular Backups**: Regularly backup database files
4. **Monitor Logs**: Monitor application logs and errors
5. **Keep Updated**: Keep system and dependencies up to date

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

1. Fork the project
2. Create a feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Disclaimer

This project is only a personal learning exercise in Vibe Coding. Please be careful if using it in production environments. I cannot guarantee the quality of this project or provide effective support.

---

**Tips**:
- First-time access to the admin panel requires setting an admin password
- Recommended to use a reverse proxy (like Nginx) in production environments
- Regularly backup database files to prevent data loss