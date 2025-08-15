// AuditLog.tsx
import React from "react";

const AuditLog: React.FC = () => {
  const headers = ["ID", "UserID", "Action", "Resource", "Meta", "IP", "CreatedAt"];

  return (
    <div className="min-h-screen bg-[#505991] flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold text-[#FFFFFF] mb-6">Audit_log Manager</h1>

      <div className="overflow-x-auto w-full max-w-5xl">
        <table className="border-collapse border border-gray-300 w-full bg-[#FFFFFF] rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-[#FFFFFF]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="border border-gray-400 px-4 py-2 text-sm font-semibold text-[#505991]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-100">
                {headers.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-gray-300 px-4 py-5 text-sm text-[#505991]"
                  >
                    {/* Empty cells for now */}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLog;
