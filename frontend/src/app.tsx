import { Navigate, Route, Routes } from "react-router-dom";

import { GamePage } from "./pages/game";
import { HomePage } from "./pages/home";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/games/:gameId" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
