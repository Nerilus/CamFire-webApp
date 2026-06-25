import { Outlet } from "react-router-dom";
import BottomTabBar from "../components/BottomTabBar";

export default function PrivateLayout() {
  return (
    <>
      <main>
        <Outlet />
      </main>

      <BottomTabBar />
    </>
  );
}