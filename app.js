/*Important note- To run this project on localhost first give network access in mongodb atlas to your current ip address otherwise it may give error or can simply while whiltelist the (0.0.0.0/0) for testing in mongodb atlas  */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { setShowSearch } = require("./middleware");
const searchRouter = require("./routes/search.js");

// Apply to every request (this middleware only depends on nothing DB-specific)
app.use(setShowSearch);


//MVC structure — all different features separated into routes
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");



const dbUrl = process.env.ATLASDB_URL || "mongodb://localhost:27017/StayQuest";

// Connect to MongoDB with logs
async function main() {
  try {
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    // Don't crash here — keep app running so logs surface on Render
  }
}
main();

// Optional mongoose connection listeners for extra debugging
mongoose.connection.on("error", (err) => {
  console.error("MONGO CONNECTION ERROR:", err);
});
mongoose.connection.once("open", () => {
  console.log("✅ Mongoose connection open");
});


//View Engine Setup (EJS + ejsMate)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//Middleware Setup
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));


//Session Store (MongoDB)
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET || "thisshouldbeasecret",
  },
  touchAfter: 24 * 3600,
});

store.on("connected", () => {
  console.log("✅ MongoDB session store connected");
});
store.on("error", (err) => {
  console.error("❌ MONGO SESSION STORE ERROR:", err);
});


//Session Options
const sessionOptions = {
  store,
  secret: process.env.SECRET || "thisshouldbeasecret",
  resave: false,
  saveUninitialized: false, // safer: do not save empty sessions
  cookie: {
    // expires must be a Date object
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());


//Passport.js Authentication
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware: Always define locals (permanent fix)
// res.locals.currUser is always present (either user object or null)
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");

  // Permanent safety: never leave currUser undefined
  res.locals.currUser = req.user || null;

  // Dev-only debug to check sessions on Render (remove or comment out in production)
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("DEBUG: req.user =", req.user);
  }
  next();
});


app.get("/", (req, res) => {
  res.send("StayQuest backend is running");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// For search
app.use("/search", searchRouter);





// 404 handler – catches all unmatched routes
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// Error handler (keeps rendering your error page, but protects against header-sent)
app.use((err, req, res, next) => {
  console.error("ERROR HANDLER:", err);
  const { statusCode = 500, message = "Something went wrong" } = err;
  if (res.headersSent) {
    return next(err);
  }
  res.status(statusCode).render("listings/error", { message });
});

// PORT for Render or local
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
