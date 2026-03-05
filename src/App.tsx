import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DesignersPage from './pages/DesignersPage';
import DesignerProfilePage from './pages/DesignerProfilePage';
import DesignerProfileWithModalPage from './pages/DesignerProfileWithModalPage';
import ApplyPage from './pages/ApplyPage';
import MaterialsPage from './pages/MaterialsPage';
import MaterialCategoryPage from './pages/MaterialCategoryPage';
import ShowroomsPage from './pages/ShowroomsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UploadProjectPage from './pages/UploadProjectPage';

function App() {
  return (
    <Routes>
      <Route path="/designer/upload" element={<UploadProjectPage />} />
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/designers" element={<DesignersPage />} />
            <Route path="/designers/apply" element={<ApplyPage />} />
            <Route path="/designers/:slug" element={<DesignerProfilePage />} />
            <Route path="/designers/:slug/projects/:projectId" element={<DesignerProfileWithModalPage />} />
            <Route path="/showrooms" element={<ShowroomsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/materials/:category" element={<MaterialCategoryPage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}

export default App;
