const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
searchController = require("../controllers/search.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

router.get("/", upload.single("listing[image]"), searchController.search);
module.exports = router;