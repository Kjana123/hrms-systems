// Message.js
// REMOVE all local import/export statements when using type="text/babel" in index.html

const Message = ({
  message,
  type,
  clearMessage
}) => {
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const textColor = 'text-white';

  // This component will automatically disappear after a timeout set in App.js
  // The clearMessage prop can be used if you want a close button to dismiss it manually.

  return /*#__PURE__*/React.createElement("div", {
    className: `fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center space-x-3 z-50 ${bgColor} ${textColor}`
  }, type === 'success' ? /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  })) : /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-6 w-6",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
  })), /*#__PURE__*/React.createElement("p", {
    className: "font-medium"
  }, message), clearMessage && /*#__PURE__*/React.createElement("button", {
    onClick: clearMessage,
    className: "ml-auto p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-150"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-4 w-4",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  }))));
};