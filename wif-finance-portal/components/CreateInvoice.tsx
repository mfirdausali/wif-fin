import React, { useState } from 'react';
import { InputType } from '../types';

interface CreateInvoiceProps {
  onCancel: () => void;
}

const CreateInvoice: React.FC<CreateInvoiceProps> = ({ onCancel }) => {
  const [items, setItems] = useState([{ id: 1, description: '', qty: 1, price: 0 }]);
  
  const addItem = () => {
    setItems([...items, { id: Date.now(), description: '', qty: 1, price: 0 }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const subtotal = items.reduce((acc, item) => acc + (item.qty * item.price), 0);

  return (
    <div className="animate-fade-in font-sans text-sm">
      {/* Form Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-black">
        <h2 className="text-2xl font-serif font-black text-gray-900 uppercase">Create New Invoice</h2>
        <div className="text-gray-500 font-mono">REF: DRAFT-001</div>
      </div>
      
      <div className="bg-white border border-gray-300 shadow-none">
        
        {/* Primary Info Grid - Japanese Form Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-300">
           <div className="flex border-b md:border-b-0 md:border-r border-gray-300">
              <div className="w-32 bg-gray-100 p-3 border-r border-gray-300 font-bold text-xs uppercase tracking-wider flex items-center">Invoice No.</div>
              <div className="flex-1 p-0">
                <input type="text" defaultValue="WIF-INV-20251121-001" className="w-full h-full p-3 font-mono focus:bg-blue-50 focus:outline-none" />
              </div>
           </div>
           <div className="flex">
              <div className="w-32 bg-gray-100 p-3 border-r border-gray-300 font-bold text-xs uppercase tracking-wider flex items-center">Date</div>
              <div className="flex-1 p-0">
                 <input type="date" defaultValue="2025-11-21" className="w-full h-full p-3 font-mono focus:bg-blue-50 focus:outline-none" />
              </div>
           </div>
        </div>

        {/* Customer Section */}
        <div className="border-b border-gray-300">
             <div className="bg-gray-800 text-white px-4 py-1 text-xs font-bold uppercase tracking-widest">Client Information</div>
             
             <div className="grid grid-cols-1 border-b border-gray-300">
                 <div className="flex border-b border-gray-300 last:border-b-0">
                    <div className="w-32 md:w-48 bg-gray-50 p-3 border-r border-gray-300 font-bold text-gray-700 flex items-center">Customer Name</div>
                    <div className="flex-1">
                        <input type="text" className="w-full p-2 focus:bg-blue-50 focus:outline-none" placeholder="Enter official entity name" />
                    </div>
                 </div>
                 <div className="flex border-b border-gray-300 last:border-b-0">
                    <div className="w-32 md:w-48 bg-gray-50 p-3 border-r border-gray-300 font-bold text-gray-700 flex items-center">Billing Address</div>
                    <div className="flex-1">
                        <input type="text" className="w-full p-2 focus:bg-blue-50 focus:outline-none" placeholder="Registered address" />
                    </div>
                 </div>
                 <div className="flex">
                    <div className="w-32 md:w-48 bg-gray-50 p-3 border-r border-gray-300 font-bold text-gray-700 flex items-center">Contact Email</div>
                    <div className="flex-1">
                        <input type="email" className="w-full p-2 focus:bg-blue-50 focus:outline-none font-mono" placeholder="finance@client.com" />
                    </div>
                 </div>
             </div>
        </div>

        {/* Line Items Table */}
        <div className="border-b border-gray-300">
           <div className="flex justify-between items-center bg-gray-800 text-white px-4 py-1">
               <div className="text-xs font-bold uppercase tracking-widest">Details of Transaction</div>
               <button onClick={addItem} className="text-xs hover:text-gray-300 hover:underline">+ Add Row</button>
           </div>
           
           <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-gray-100 text-xs uppercase text-gray-600 border-b border-gray-300">
                 <th className="p-3 border-r border-gray-300 font-bold w-12 text-center">#</th>
                 <th className="p-3 border-r border-gray-300 font-bold">Description</th>
                 <th className="p-3 border-r border-gray-300 font-bold w-24 text-right">Qty</th>
                 <th className="p-3 border-r border-gray-300 font-bold w-32 text-right">Unit Price</th>
                 <th className="p-3 font-bold w-32 text-right">Amount</th>
                 <th className="w-10"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={item.id} className="group hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-300 text-center text-gray-400 font-mono">{index + 1}</td>
                    <td className="p-0 border-r border-gray-300">
                        <input 
                            type="text" 
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            className="w-full p-2 focus:bg-blue-50 focus:outline-none bg-transparent"
                        />
                    </td>
                    <td className="p-0 border-r border-gray-300">
                        <input 
                            type="number" 
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                            className="w-full p-2 text-right font-mono focus:bg-blue-50 focus:outline-none bg-transparent"
                        />
                    </td>
                    <td className="p-0 border-r border-gray-300">
                        <input 
                            type="number" 
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 text-right font-mono focus:bg-blue-50 focus:outline-none bg-transparent"
                        />
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-gray-900">
                        {(item.qty * item.price).toFixed(2)}
                    </td>
                    <td className="text-center">
                         <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-wif-red font-bold">×</button>
                    </td>
                  </tr>
                ))}
             </tbody>
           </table>
        </div>

        {/* Totals Section */}
        <div className="flex flex-col md:flex-row border-b border-gray-300">
             <div className="flex-1 border-r border-gray-300 p-4 space-y-4 bg-gray-50">
                <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase text-gray-500">Notes / Remarks</label>
                    <textarea className="w-full p-2 border border-gray-300 h-24 text-sm focus:border-black focus:outline-none"></textarea>
                </div>
             </div>
             
             <div className="w-full md:w-80 bg-white">
                 <div className="flex justify-between p-3 border-b border-gray-200">
                     <span className="text-sm text-gray-600">Subtotal</span>
                     <span className="font-mono font-bold">MYR {subtotal.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between p-3 border-b border-gray-200 items-center">
                     <span className="text-sm text-gray-600">Tax (10%)</span>
                     <span className="font-mono text-sm text-gray-500">0.00</span>
                 </div>
                 <div className="flex justify-between p-4 bg-gray-100 items-center">
                     <span className="font-serif font-bold text-lg text-gray-900">TOTAL</span>
                     <span className="font-mono font-bold text-xl text-wif-red border-b-2 border-wif-red">MYR {subtotal.toFixed(2)}</span>
                 </div>
             </div>
        </div>

      </div>
      
      {/* Footer Actions */}
      <div className="mt-8 flex justify-end gap-4">
        <button onClick={onCancel} className="px-6 py-2 border border-gray-300 bg-white text-gray-700 text-sm font-bold uppercase tracking-wide hover:bg-gray-50">
          Discard
        </button>
        <button onClick={onCancel} className="px-8 py-2 bg-wif-red text-white text-sm font-bold uppercase tracking-wide hover:bg-red-700 shadow-sm">
          Issue Invoice
        </button>
      </div>
    </div>
  );
};

export default CreateInvoice;