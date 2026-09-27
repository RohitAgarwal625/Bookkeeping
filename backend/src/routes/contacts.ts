import { Router } from "express";
import {
  listContacts,
  createContact,
  getContact,
  updateContact,
  deleteContact,
} from "../controllers/contacts.controller";
import { sessionAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { readLimiter, writeLimiter } from "../middleware/rateLimiter";
import {
  createContactSchema,
  updateContactSchema,
  contactIdSchema,
  listContactsSchema,
} from "../schemas/contact.schema";

const router = Router();

// All contact routes require authentication.
router.use(sessionAuth);

router.get("/", readLimiter, validate(listContactsSchema), listContacts);
router.post("/", writeLimiter, validate(createContactSchema), createContact);
router.get("/:id", readLimiter, validate(contactIdSchema), getContact);
router.put("/:id", writeLimiter, validate(updateContactSchema), updateContact);
router.delete("/:id", writeLimiter, validate(contactIdSchema), deleteContact);

export default router;
