import React from 'react';
import { FileText } from 'lucide-react';
import { motion } from 'framer-motion';

const ParseProgress = ({ fileName, status, progress }) => {
    return (
        <div className="w-full max-w-md mx-auto mt-6 bg-white p-6 rounded-xl shadow-lg border border-[#E0F7FF]">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-[#E0F7FF] p-2 rounded text-[#00B4D8]">
                    <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">
                        Analyzing {fileName}
                    </p>
                    <p className="text-xs text-gray-500 animate-pulse">
                        {status}
                    </p>
                </div>
                <span className="text-sm font-bold text-[#00B4D8]">{Math.round(progress)}%</span>
            </div>

            <div className="relative h-4 w-full bg-[#E0F7FF] rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 bg-[#00B4D8] rounded-full"
                >
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full h-full -skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
                </motion.div>
            </div>
        </div>
    );
};

export default ParseProgress;