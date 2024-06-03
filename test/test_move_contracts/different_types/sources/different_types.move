module different_types::different_types {
    use std::string::{Self, utf8, String};
    use std::type_name;

    /// A shared object. `key` ability is required.
    public struct Store has key {
        id: UID,
        numbers: u256,
        v_bool: bool,
        v_address: address,
        v_string: String,
    }


    /// Init function is often ideal place for initializing
    /// a shared object as it is called only once.
    /// To share an object `transfer::share_object` is used.
    fun init(ctx: &mut TxContext) {
        let id = object::new(ctx);
        // Share the object to make it accessible to everyone!
        transfer::share_object(Store {
            id: id,
            numbers: 0,
            v_bool: false,
            v_address: @0xABBA,
            v_string: utf8(b""),
        })
    }

    public entry fun put_u8(store: &mut Store, value: u8, _ctx: &mut TxContext) {
        store.numbers = store.numbers + (value as u256);
    }
    public entry fun put_u16(store: &mut Store, value: u16, _ctx: &mut TxContext) {
        store.numbers = store.numbers + (value as u256);
    }
    public entry fun put_u32(store: &mut Store, value: u32, _ctx: &mut TxContext) {
        store.numbers = store.numbers + (value as u256);
    }
    public entry fun put_u64(store: &mut Store, value: u64, _ctx: &mut TxContext) {
        store.numbers = store.numbers + (value as u256);
    }
    public entry fun put_u128(store: &mut Store, value: u128, _ctx: &mut TxContext) {
        store.numbers = store.numbers + (value as u256);
    }
    public entry fun put_u256(store: &mut Store, value: u256, _ctx: &mut TxContext) {
        store.numbers = store.numbers + (value as u256);
    }
    public entry fun put_vector_u16(store: &mut Store, value: vector<u16>, _ctx: &mut TxContext) {
        let vec_length = vector::length(&value);
        let mut i = 0;
        while (i < vec_length) {
            store.numbers = store.numbers + (*vector::borrow(&value, i) as u256);

            i = i + 1;
        };
    }
    public entry fun put_address(store: &mut Store, value: address, _ctx: &mut TxContext) {
        store.v_address = value;
    }
    public entry fun put_bool(store: &mut Store, value: bool, _ctx: &mut TxContext) {
        store.v_bool = value;
    }
    public entry fun put_string(store: &mut Store, value: String, _ctx: &mut TxContext) {
        store.v_string = value;
    }

    public entry fun put_type<T>(store: &mut Store, _ctx: &mut TxContext) {
        let typen = type_name::get<T>();
        let type_as_string = typen.into_string(); // returns ascii string

        store.v_string = string::from_ascii(type_as_string);
    }
}
