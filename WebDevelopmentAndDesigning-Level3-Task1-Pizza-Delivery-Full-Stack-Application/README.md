# Pizza Delivery and Inventory Management System

**Oasis Infobyte — Web Development & Designing Internship**

**Project:** Pizza Delivery and Inventory Management System  
**Developer:** Raunak Sharma  
**Internship Track:** Web Development & Designing  
**Technology:** React, TypeScript, Node.js, Express.js, MongoDB  
**Payment Integration:** eSewa ePay V2  
**Project Status:** Completed — Final Evaluation Preparation

---

## 1. Project Overview

The Pizza Delivery and Inventory Management System is a full-stack web application designed to simplify online pizza ordering and streamline restaurant operations through a centralized management system.

The application provides customers with an intuitive interface to explore available pizzas, customize their orders, manage their shopping cart, complete checkout, make online payments, and track their orders.

It also provides administrators with a dedicated dashboard to monitor business activities, manage customer orders, maintain inventory, and monitor low-stock items.

The system uses a React-based frontend and a Node.js/Express backend connected to MongoDB, ensuring structured data management and reliable communication between the customer interface and administrative system.

## 2. Problem Statement

Traditional pizza ordering and inventory management processes can involve manual order handling, inefficient stock tracking, limited order visibility, and difficulties managing customer requests.

Restaurants need a centralized platform that can:

- Simplify the online ordering experience.
- Allow customers to customize their pizzas.
- Validate product availability before checkout.
- Process online payments.
- Provide order tracking and status updates.
- Help administrators manage orders and inventory.
- Reduce manual inventory-management work.

The objective of this project is to address these challenges through an integrated web-based solution.

## 3. Proposed Solution

The proposed system combines customer-facing online ordering functionality with administrative management tools.

Customers can browse the pizza catalog, customize available options, add products to their cart, and place orders through a structured checkout process.

The backend validates order details, calculates totals, communicates with the database, and handles payment verification.

Administrators can monitor dashboard statistics, manage orders, update inventory, and identify low-stock products.

The system is designed with a modular architecture so that individual modules can be maintained and extended independently.

## 4. Key Features

### 4.1 Customer Features

**Authentication and Account Management**
- Customer registration and login.
- Secure password hashing.
- JWT-based authentication.
- Access and refresh token handling.
- Email verification functionality.
- Resend verification functionality.
- Forgot-password and reset-password functionality.
- Customer profile management.

**Pizza Catalog**
- Browse available pizzas.
- View individual pizza details.
- Explore featured pizzas.
- View customization options.
- Check product availability.

**Pizza Customization**
- Select available customization options.
- Customize pizza orders.
- View calculated prices based on selections.

**Shopping Cart and Checkout**
- Add products to the cart.
- Update product quantities.
- Remove products from the cart.
- Validate product availability.
- Calculate order totals on the backend.
- Apply delivery charges.
- Validate stock before order placement.

**Order Management**
- Place orders.
- View order history.
- View individual order details.
- Track order status.
- Request order cancellation where permitted.

**Online Payment**
- eSewa ePay V2 integration.
- Backend-driven payment initiation.
- Server-side payment verification.
- Transaction amount validation.
- Transaction UUID validation.
- Signature validation.
- Duplicate verification protection.

### 4.2 Admin Features

**Admin Dashboard**
- View business overview and dashboard statistics.
- Monitor order activity.
- Access order and inventory management modules.

**Order Management**
- View customer orders.
- Inspect order details.
- Update order statuses.
- Manage order processing.

**Inventory Management**
- View inventory records.
- Monitor available stock.
- Update inventory quantities.
- Perform stock adjustments.
- Identify low-stock items.

**Settings**
- Access the administrative settings section.

**Access Control**
- Protected administrative routes.
- Role-based authorization.
- Restricted access to administrative functionality.

## 5. Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui, where implemented |
| Backend | Node.js |
| API Framework | Express.js |
| Backend Language | TypeScript |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Authentication | JWT |
| Password Security | bcrypt |
| Payment Gateway | eSewa ePay V2 |
| Testing | Existing backend automated test suite |
| Version Control | Git and GitHub |

## 6. System Architecture

The application follows a client-server architecture.

### Frontend Layer

The React application provides the customer and administrator interfaces.

Responsibilities include:
- Rendering application pages.
- Handling user interactions.
- Managing client-side application state.
- Validating user input.
- Communicating with backend APIs.
- Displaying order and payment information.

### Backend Layer

The Express.js application handles application logic and API requests.

Responsibilities include:
- Authentication and authorization.
- Request validation.
- Pizza catalog management.
- Order processing.
- Checkout validation.
- Payment initiation and verification.
- Inventory management.
- Administrative operations.

### Database Layer

MongoDB Atlas stores application data, including:
- User accounts.
- Pizza catalog information.
- Customization options.
- Orders.
- Payment information.
- Inventory records.

### Payment Layer

The eSewa payment integration handles payment initiation and server-side transaction verification.

The backend validates payment information before considering a transaction successful.

### Architecture Flow

Customer/Admin → React Frontend → Express REST API → Backend Services → MongoDB Atlas

Payment flow:

Customer Checkout → Backend Payment Initiation → eSewa → Backend Transaction Verification → Order Payment Status Update

## 7. Project Structure

The repository is organized into separate frontend and backend applications.

```text
OIBSIP/
│
├── client/
│   ├── public/
│   │   ├── robots.txt
│   │   └── sitemap.xml
│   │
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── pages/
│   │   └── ...
│   │
│   ├── index.html
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middleware/
│   │   └── ...
│   │
│   ├── package.json
│   └── ...
│
├── README.md
└── .gitignore
```

*Note: This is a high-level representation. Refer to the actual repository for the complete directory structure.*

## 8. Installation and Setup

### Prerequisites

Install the following before running the application:

- Node.js and npm.
- MongoDB Atlas account or an accessible MongoDB instance.
- Git.
- A code editor such as Visual Studio Code.

### Step 1: Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd OIBSIP
```

### Step 2: Install Backend Dependencies

```bash
cd server
npm install
```

### Step 3: Configure Backend Environment Variables

Create a `.env` file inside the `server` directory.

Configure the variables required by the backend application.

Typical configuration includes:

```env
MONGODB_URI=your_mongodb_connection_string
FRONTEND_URL=http://localhost:5173

JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_token_secret

# Configure eSewa sandbox credentials
# Configure SMTP credentials if email delivery is enabled

# Configure other application settings
# according to the server configuration
```

Use the actual variable names defined in the server configuration and `.env.example`. Do not commit real credentials.

### Step 4: Seed Initial Data

From the server directory:

```bash
npm run seed
```

The seed script initializes the sample application data and administrative account according to the project's seed configuration.

Use the configured administrator credentials rather than assuming default credentials.

### Step 5: Start the Backend

```bash
npm run dev
```

The backend runs on the configured development port, normally:

```text
http://localhost:5000
```

### Step 6: Install Frontend Dependencies

Open another terminal:

```bash
cd client
npm install
```

### Step 7: Configure Frontend Environment Variables

Create a `.env` file inside the `client` directory.

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_MOCK=false
```

### Step 8: Start the Frontend

```bash
npm run dev
```

Open the development URL:

```text
http://localhost:5173
```

The frontend should now communicate with the backend API.

## 9. Payment Integration

The project implements eSewa ePay V2 for online payment processing.

The payment process follows these steps:

1. The customer completes checkout.
2. The backend validates the order and calculates the payable amount.
3. The backend initiates the payment request.
4. The customer is redirected to the eSewa payment environment.
5. After the payment attempt, the application receives the payment result.
6. The backend verifies the transaction.
7. The transaction amount, UUID, and signature are validated.
8. The order payment status is updated according to the verified result.

**Important implementation note:**

The original internship task referenced Razorpay. The project uses eSewa instead, adapting the payment integration to a payment provider suitable for the Nepal-based project environment.

The eSewa sandbox may experience external availability issues. Automated backend tests cover the payment verification logic, but a successful live sandbox transaction should only be claimed after it has actually been completed.

## 10. Security Implementation

The application includes the following security measures:

- Password hashing using bcrypt.
- JWT-based authentication.
- Access and refresh token handling.
- Role-based authorization.
- Protected customer and admin routes.
- Server-side checkout validation.
- Server-side payment verification.
- Transaction signature validation.
- Duplicate payment verification protection.
- Environment-based secret management.
- CORS configuration.

Sensitive credentials are stored in environment variables and should not be committed to the public repository.

## 11. SEO and Performance Optimization

The project includes technical and on-page SEO improvements.

Implemented improvements include:

- Page metadata.
- Meta descriptions.
- Open Graph metadata.
- Twitter card metadata.
- Canonical URL configuration where applicable.
- XML sitemap.
- Robots.txt.
- Organization and WebSite structured data.
- Vite-based production build and code splitting.
- Lazy loading where implemented.
- Optimized frontend rendering.

These improvements help search engines understand the public-facing pages and improve the application's technical SEO foundation. Search rankings and indexing are determined by search engines and are not guaranteed.

## 12. Testing and Quality Assurance

The project underwent frontend and backend verification.

### Backend Testing

- Backend automated test suite: 95/95 tests passed.
- Test files: 7.
- Authentication and application logic tested through the existing test suite.
- Payment verification logic covered by automated tests.

### Frontend Verification

- Production build completed successfully.
- Frontend routes reviewed.
- API integration reviewed.
- Protected customer routes checked.
- Admin route authorization reviewed.
- Customer and administrative flows reviewed.

### Build Command

From the client directory:

```bash
npm run build
```

### Backend Test Command

From the server directory:

```bash
npm test
```

### Known Limitations

- eSewa sandbox availability may affect manual end-to-end payment testing.
- MongoDB Atlas DNS connectivity may vary depending on the network.
- ESLint reported outstanding type-related issues during the final audit and should be reviewed separately.

The test results represent the project's reported automated and build verification. External services should be tested independently when available.

## 13. Screenshots

Add actual screenshots of the completed application in this section.

Suggested screenshots:

1. Homepage and navigation.
2. Pizza catalog.
3. Pizza details and customization.
4. Shopping cart.
5. Checkout.
6. eSewa payment page or successful payment result.
7. Customer order history.
8. Order tracking.
9. Admin dashboard.
10. Admin order management.
11. Inventory management.
12. Low-stock alerts.

Store the screenshots in a folder such as:

```text
docs/screenshots/
```

Then embed them using Markdown:

```markdown
![Homepage](docs/screenshots/homepage.png)
![Pizza Catalog](docs/screenshots/menu.png)
![Shopping Cart](docs/screenshots/cart.png)
![Admin Dashboard](docs/screenshots/admin-dashboard.png)
```

Replace the example filenames with the actual screenshots included in the repository.

## 14. Project Demonstration

**Demo Video:** [Add your demonstration video link]

The demonstration should cover:

- Homepage and pizza catalog.
- Customer registration and login.
- Pizza customization.
- Cart and checkout.
- Payment flow.
- Order history and tracking.
- Admin dashboard.
- Order management.
- Inventory management.

The first two seconds of the video should clearly display:

**Raunak Sharma**  
**Web Development & Designing**  
**Pizza Delivery and Inventory Management System**

## 15. Future Improvements

Potential improvements for future development include:

- Complete product CRUD functionality from the admin dashboard.
- Advanced sales analytics and reporting.
- Automated low-stock email notifications.
- Scheduled inventory monitoring.
- Real-time order status notifications.
- Customer reviews and ratings.
- Promotional coupons and discount management.
- Delivery personnel management.
- Enhanced search and filtering.
- Additional payment gateway options.

These are future enhancements and should not be interpreted as features already implemented.

## 16. Conclusion

The Pizza Delivery and Inventory Management System demonstrates the development of a full-stack web application integrating customer ordering, authentication, pizza customization, online payments, order management, and inventory administration.

The project applies modern frontend and backend technologies to address practical restaurant-management requirements.

Through this internship project, practical experience was gained in full-stack application development, REST API integration, database management, authentication, payment gateway integration, testing, and technical SEO.

The project provides a foundation for a scalable pizza ordering and restaurant management platform.

---

## 17. Project Information

**Developer:** Raunak Sharma  
**Internship Organization:** Oasis Infobyte  
**Internship Track:** Web Development & Designing  
**Project Title:** Pizza Delivery and Inventory Management System  
**Repository:** [Add GitHub Repository URL]  
**Live Demo:** [Add Deployment URL, if available]  
**Demonstration Video:** [Add Video URL]

---

## Acknowledgement

I would like to express my gratitude to Oasis Infobyte for providing the opportunity to work on this project as part of the Web Development and Designing Internship.

This project helped me strengthen my practical understanding of full-stack development and apply software engineering concepts to a real-world application scenario.

**Developed by Raunak Sharma**