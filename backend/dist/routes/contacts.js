"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contacts_controller_1 = require("../controllers/contacts.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const rateLimiter_1 = require("../middleware/rateLimiter");
const contact_schema_1 = require("../schemas/contact.schema");
const router = (0, express_1.Router)();
// All contact routes require authentication.
router.use(auth_1.sessionAuth);
router.get("/", rateLimiter_1.readLimiter, (0, validate_1.validate)(contact_schema_1.listContactsSchema), contacts_controller_1.listContacts);
router.post("/", rateLimiter_1.writeLimiter, (0, validate_1.validate)(contact_schema_1.createContactSchema), contacts_controller_1.createContact);
router.get("/:id", rateLimiter_1.readLimiter, (0, validate_1.validate)(contact_schema_1.contactIdSchema), contacts_controller_1.getContact);
router.put("/:id", rateLimiter_1.writeLimiter, (0, validate_1.validate)(contact_schema_1.updateContactSchema), contacts_controller_1.updateContact);
router.delete("/:id", rateLimiter_1.writeLimiter, (0, validate_1.validate)(contact_schema_1.contactIdSchema), contacts_controller_1.deleteContact);
exports.default = router;
//# sourceMappingURL=contacts.js.map