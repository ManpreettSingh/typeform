import { createContext, useContext } from "react";

/**
 * The public slug of the form being filled, set by the public page only. Answers that talk to the API for themselves
 * (file uploads) need it; previews have none, so they keep chosen files in the browser instead.
 */
export const FormSlugContext = createContext<string | null>(null);

export const useFormSlug = () => useContext(FormSlugContext);
