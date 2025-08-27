// server/utils/runnerNumberAssignment.js

export async function assignRunnerNumbers(groupId, supabase) {
  if (!groupId || !supabase) {
    return { success: false, error: 'Parámetros faltantes', assigned: 0, numbers: [] };
  }
  
  try {
    // Buscar runners sin número
    const { data: runners, error: fetchError } = await supabase
      .from('runners')
      .select('*')
      .eq('group_id', groupId)
      .is('runner_number', null);
    
    if (fetchError || !runners || runners.length === 0) {
      return { success: true, assigned: 0, numbers: [] };
    }

    // Obtener contador
    const { data: counter, error: counterError } = await supabase
      .from('runner_numbers')
      .select('*')
      .single();
    
    if (counterError || !counter) {
      return { success: false, error: 'No se pudo obtener contador', assigned: 0, numbers: [] };
    }

    let currentNumber = counter.current_number;
    const assignedNumbers = [];
    
    // Asignar números con formato
    for (const runner of runners) {
      const formattedNumber = currentNumber.toString().padStart(4, '0');
      const { data: updated, error: updateError } = await supabase
        .from('runners')
        .update({ 
          runner_number: formattedNumber, // ⬅️ Guardar con formato
          payment_status: 'confirmado',
          payment_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', runner.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`❌ Error actualizando ${runner.full_name}:`, updateError);
      } else {
        assignedNumbers.push({
          runner_id: runner.id,
          runner_name: runner.full_name,
          number: formattedNumber // ⬅️ Devolver con formato
        });
        currentNumber++;
      }
    }
    
    // Actualizar contador
    if (assignedNumbers.length > 0) {
      await supabase
        .from('runner_numbers')
        .update({ 
          current_number: currentNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', counter.id);
    }

    return {
      success: true,
      assigned: assignedNumbers.length,
      numbers: assignedNumbers
    };
    
  } catch (error) {
    console.error('❌ ERROR en assignRunnerNumbers:', error);
    return { 
      success: false, 
      error: error.message,
      assigned: 0,
      numbers: []
    };
  }
}

export default { assignRunnerNumbers };