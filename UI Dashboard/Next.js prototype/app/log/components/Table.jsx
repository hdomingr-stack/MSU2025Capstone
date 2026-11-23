import './Table.css';

const Table = ({ columns, rows }) => {

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            {columns.map((col) => (
              <td key={col.key}>{r[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;
