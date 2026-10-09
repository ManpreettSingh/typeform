# Phase 2: Images, Themes, and Picture Choice

## Goal
Implement images and design parity (Cloudinary uploads, image layouts, Picture Choice question type, and Theme customization) as per Phase 2 of the spec.

## Scope
1. **Media Attachments:** Add `attachment` and `layout` (stack, split, float, wallpaper) structures to questions, welcome screens, and endings.
2. **Cloudinary Integration:** Implement backend routes for signing Cloudinary uploads, and frontend upload flow. Add fake Cloudinary endpoints to the e2e stack for isolated testing.
3. **Picture Choice:** Implement the `picture_choice` question type natively.
4. **Themes:** Build the custom theme editor (colors, font, background image) and a gallery of 30 free themes.
5. **Previews:** Ensure builder has mobile and desktop preview modes.

## Tasks

### Task 1: Media Database Schema & Core Types
- **Scope:** Update `backend/app/schemas/properties.py` to include a reusable `MediaAttachment` model (`type`, `public_id`, `url`, `alt`) and `MediaLayout` model (`type`: stack/split/float/wallpaper, `placement`: left/right).
- **Scope:** Add these properties to `FormWelcome`, `Ending`, and `QuestionProperties`. Update `frontend/lib/types.ts` to mirror this.
- **Verification:** Backend tests pass with new optional properties.

### Task 2: Cloudinary Upload Infrastructure & Fake Server
- **Scope:** Add fake Cloudinary upload endpoints to `scripts/e2e-stack.mjs`. 
- **Scope:** Create `backend/app/services/media.py` for Cloudinary signatures (falling back to fake URLs in test mode) and a `POST /api/media/sign` endpoint. 
- **Verification:** `npm run e2e:start` intercepts media uploads securely, backend returns signed payloads.

### Task 3: Media Upload UI & Layout Settings
- **Scope:** Build the frontend `MediaUploader` component that interacts with the backend signature and pushes to Cloudinary.
- **Scope:** Add layout settings to the right-side properties panel in the builder.
- **Verification:** Users can upload an image and change layout (stack/split/float/wallpaper) visually in the builder.

### Task 4: Respondent Canvas Media Rendering
- **Scope:** Update `QuestionShell`, `WelcomeScreen`, and `EndingScreen` to render the `attachment` according to its `layout` using Typeform's responsive break points.
- **Verification:** Visual browser check ensures floating and split layouts look exactly like Typeform's free plan.

### Task 5: Picture Choice Question Type
- **Scope:** Add `picture_choice` to `backend/app/question_types/` with its unique properties (images per choice, multiple selection).
- **Scope:** Update frontend registry, `PictureChoiceSettings`, and the visual `PictureChoiceAnswer` grid.
- **Verification:** Picture Choice can be created, answered, and correctly summarized in the Results tab.

### Task 6: Themes Schema & 30 Free Themes Seed
- **Scope:** Formalize the `theme` JSON structure in `backend/app/schemas/form.py` (colors: question, answer, button, background; font; background_image). 
- **Scope:** Expand `backend/app/seed.py` to generate the 30 free themes available in Typeform's gallery.
- **Verification:** Migrations/Seed successfully create the themes and apply a default theme to new forms.

### Task 7: Theme Editor & Previews
- **Scope:** Build the Theme customization panel (color pickers, font selector, background image uploader).
- **Scope:** Implement the desktop/mobile preview toggle in the Builder TopBar.
- **Verification:** Changing colors/fonts instantly updates the preview canvas. Final side-by-side sweep of Phase 2 features.
