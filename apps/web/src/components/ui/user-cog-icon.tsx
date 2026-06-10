"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

export interface UserCogIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface UserCogIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const PATH_VARIANT: Variants = {
  normal: { pathLength: 1, opacity: 1, pathOffset: 0 },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    pathOffset: [1, 0],
  },
};

const UserCogIcon = forwardRef<UserCogIconHandle, UserCogIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.circle
            animate={controls}
            cx="9"
            cy="7"
            initial="normal"
            r="4"
            variants={PATH_VARIANT}
          />
          <motion.path
            animate={controls}
            d="M10 15H6a4 4 0 0 0-4 4v2"
            initial="normal"
            variants={PATH_VARIANT}
          />
          <motion.circle
            animate={controls}
            cx="18"
            cy="15"
            initial="normal"
            r="3"
            variants={PATH_VARIANT}
          />
          <motion.path
            animate={controls}
            d="m21.7 16.4-.9-.3m-5.6-2.2-.9-.3m2.3 5.1.3-.9m2.2-5.6.3-.9m.5 6.4-.4-1m-2.4-5.4-.4-1m-2.1 5.3 1-.4m5.4-2.4 1-.4"
            initial="normal"
            variants={PATH_VARIANT}
          />
        </svg>
      </div>
    );
  }
);

UserCogIcon.displayName = "UserCogIcon";

export { UserCogIcon };
