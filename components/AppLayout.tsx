import { HStack, Link } from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
import { LuGithub } from "react-icons/lu";
import { FaXTwitter } from "react-icons/fa6";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      {/* Dark Mode Toggle & Social Links - Top Right Corner */}
      <div className="fixed top-4 right-4 z-50">
        <HStack gap={2}>
          <Link
            href="https://github.com/rodgetech/rate-reddit"
            target="_blank"
            rel="noopener noreferrer"
            p={2}
            borderRadius="md"
            _hover={{ bg: "gray.100", _dark: { bg: "gray.700" } }}
            _focus={{ outline: "none", boxShadow: "none" }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "blue.500",
              outlineOffset: "2px",
            }}
            transition="background-color 0.2s"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <LuGithub size={18} />
          </Link>
          <Link
            href="https://x.com/rodgetech"
            target="_blank"
            rel="noopener noreferrer"
            p={2}
            borderRadius="md"
            _hover={{ bg: "gray.100", _dark: { bg: "gray.700" } }}
            _focus={{ outline: "none", boxShadow: "none" }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "blue.500",
              outlineOffset: "2px",
            }}
            transition="background-color 0.2s"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <FaXTwitter size={18} />
          </Link>
          <ColorModeButton />
        </HStack>
      </div>

      <main className="flex flex-col gap-[10px] row-start-2 items-center sm:items-start max-w-2xl w-full">
        {children}
      </main>
    </div>
  );
}
