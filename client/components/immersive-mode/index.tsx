import React, {
  useRef,
  useEffect,
  useState,
  Suspense,
} from "react";
import { Button, Dialog } from "@radix-ui/themes";
import { Maximize2, X } from "lucide-react";
import { useRadioStore } from "@/store/useRadiostore";
import Loader from "@/components/layout/Loader";
import { useVisualizer } from "@/hooks/useVisualizer";

interface VisualizerCanvasProps {
  isActive: boolean;
  streamType: "hls" | "tone" | null;
  audioRefObject?: React.RefObject<HTMLAudioElement | null>;
  stationName?: string;
}

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  isActive,
  streamType,
  audioRefObject,
  stationName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const { resetGlobalSource } = useVisualizer({
    canvasRef,
    isActive,
    streamType,
    audioRefObject,
    stationName,
  });

  useEffect(() => {
    return () => {
      resetGlobalSource();
    };
  }, [resetGlobalSource]);

  return <canvas ref={canvasRef} className="vz-canvas" />;
};


interface ImmersiveVisualizerProps {
  currentStation: number;
  streamType?: "hls" | "tone" | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

const ImmersiveVisualizer: React.FC<ImmersiveVisualizerProps> = ({
  currentStation,
  streamType = null,
  audioRef,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { stations } = useRadioStore() as {
    stations: Array<{ name?: string }>;
  };
  const currentStationData = stations?.[currentStation];
  
  // Conditions & Derived UI values extracted for cleaner JSX
  const stationName = currentStationData?.name ?? "";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <Button
        variant="ghost"
        size="2"
        onClick={() => setIsOpen(true)}
        className="cursor-pointer hover:bg-[#FF914D]/10"
        title="Immersive Mode"
      >
        <Maximize2 size={20} color="#FF914D" />
      </Button>
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content
          className="vz-fullscreen-dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            padding: 0,
            margin: 0,
            maxWidth: "100vw",
            maxHeight: "100vh",
            overflow: "hidden",
            border: "none",
            borderRadius: 0,
          }}
        >
          <div className="vz-wrapper">
            <div className="vz-wrapper -canvas">
              <Suspense
                fallback={
                  <div
                    style={{
                      position: "fixed",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 1001,
                    }}
                  >
                    <Loader loadingText="Brace Yourself!" />
                  </div>
                }
              >
                {isOpen && (
                  <VisualizerCanvas
                    isActive={isOpen}
                    streamType={streamType ?? null}
                    audioRefObject={audioRef}
                    stationName={stationName}
                  />
                )}
              </Suspense>
            </div>
            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="vz-close-button cursor-pointer"
            >
              <X size={28} color="#FAF9F6" />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

export default ImmersiveVisualizer;
