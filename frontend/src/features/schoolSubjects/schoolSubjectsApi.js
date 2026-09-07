// School-wide (master) subject CRUD — this is the whole-school subject
// catalogue, independent of any class. It reuses the same backend endpoints
// as the original subjects feature (`/subjects`), just re-exported under a
// clearer name for this section of the app.
export { subjectsApi as schoolSubjectsApi } from '../subjects/Subjectsapi';
