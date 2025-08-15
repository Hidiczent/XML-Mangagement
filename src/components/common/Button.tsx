type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
};

export default function Button({ isLoading, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={
        "inline-flex items-center justify-center rounded-md px-4 py-2 " +
        "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      }
      disabled={isLoading || rest.disabled}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
}
