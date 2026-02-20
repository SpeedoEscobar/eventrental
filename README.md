# F S Rental - Event Rental Management System

A comprehensive digital management system for event rental services, designed for F S Rental to streamline booking, inventory management, payments, and customer relationships.

## Features

### Customer-Facing Website
- **Modern, Responsive Design** - Beautiful UI that works on all devices
- **Equipment Browsing** - Browse rental items by category (Seating, Tents, Sound & Lighting, Decor)
- **Online Booking** - Select items, choose dates, and complete bookings online
- **Availability Checking** - Real-time availability verification
- **Mobile Money Payment** - Instructions for MTN MoMo payment

### Admin Dashboard
- **Dashboard Overview** - Quick stats on bookings, revenue, and pending payments
- **Booking Management** - View, confirm, and manage all bookings
- **Inventory Management** - Add, edit, enable/disable rental items
- **Customer Management** - View customer history and contact information
- **Reports & Analytics** - Revenue reports, popular items, and business insights

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Authentication**: JWT (JSON Web Tokens)
- **Styling**: Modern CSS with CSS Variables

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. Clone or download the project:
   ```bash
   cd eventrental
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Update the values as needed:
   ```env
   PORT=3000
   JWT_SECRET=your-secure-secret-key
   ADMIN_EMAIL=admin@fsrental.com
   ADMIN_PASSWORD=your-password
   MOMO_NAME=F S RENTAL
   MOMO_NUMBER=0553319320
   MOMO_NETWORK=MTN MoMo
   ```

4. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. Visit the application:
   - Website: http://localhost:3000
   - Admin Login: http://localhost:3000/login.html


**Important:** Change these credentials in production!

## Project Structure

```
eventrental/
├── server.js          # Main server file
├── db.js              # Database setup and utilities
├── package.json       # Dependencies and scripts
├── .env               # Environment configuration
├── data/
│   └── app.db         # SQLite database (auto-created)
├── middleware/
│   └── auth.js        # Authentication middleware
└── public/
    ├── index.html     # Main website
    ├── login.html     # Admin login page
    ├── admin.html     # Admin dashboard
    ├── style.css      # Global styles
    ├── app.js         # Customer-facing JavaScript
    └── admin.js       # Admin dashboard JavaScript
```

## API Endpoints

### Public Endpoints
- `GET /api/items` - Get all active rental items
- `POST /api/availability` - Check item availability for dates
- `POST /api/bookings/create` - Create a new booking
- `GET /api/momo-details` - Get MoMo payment details

### Admin Endpoints (Requires Authentication)
- `POST /api/auth/login` - Admin login
- `GET /api/admin/items` - Get all items
- `POST /api/admin/items` - Add new item
- `PUT /api/admin/items/:id` - Update item
- `DELETE /api/admin/items/:id` - Delete item
- `GET /api/admin/bookings` - Get all bookings
- `PUT /api/admin/bookings/:id/mark-paid` - Mark booking as paid
- `PUT /api/admin/bookings/:id/complete` - Mark booking as completed
- `PUT /api/admin/bookings/:id/cancel` - Cancel booking

## Booking Workflow

1. **Customer browses equipment** on the website
2. **Selects items** and adds them to cart
3. **Chooses dates** for the event
4. **Fills in contact and delivery information**
5. **Submits booking** and receives MoMo payment instructions
6. **Makes payment** via Mobile Money
7. **Admin verifies** payment and marks booking as paid
8. **Equipment is delivered** on the event date
9. **Admin marks booking as completed** after the event

## Screenshots

The system features:
- Clean, modern hero section with statistics
- Category-filtered inventory browsing
- Responsive booking form with validation
- Professional admin dashboard with sidebar navigation
- Revenue and analytics reports

## Customization

### Adding New Categories
Edit `public/app.js` and update the `getItemCategory()` function to recognize new keywords.

### Styling
All styles are in `public/style.css` using CSS custom properties for easy theming:
```css
:root {
  --primary: #6366f1;
  --secondary: #10b981;
  /* etc. */
}
```

### Payment Integration
Currently uses manual MoMo instructions. For automated payments, integrate with:
- Paystack
- Flutterwave
- MTN MoMo API

## Security Notes

1. **Change JWT Secret** - Use a strong, unique secret in production
2. **Change Admin Password** - Update default credentials immediately
3. **Use HTTPS** - Deploy behind a reverse proxy with SSL
4. **Regular Backups** - Back up the SQLite database regularly

## Support

For questions or issues, contact:
- Phone: +233 0553319320
- Email: info@fsrental.com

## License

This project was created for F S Rental as part of a digital transformation initiative.

---

Built with ❤️ for FS Rental
